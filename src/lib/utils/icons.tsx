import React from 'react';
import { WineCharacteristics } from '@/lib/types/types';
import { GrapeVariety } from '@/lib/types/types';
import { WorkCategory } from '@/lib/types/types';
import { WORK_CATEGORY_INFO } from '@/lib/constants/activityConstants';
import { cn, getCharacteristicDisplayName, getCharacteristicIconSrc, getGrapeIconSrc, getStoryImageSrc } from './utils';
import { UnifiedTooltip } from '@/components/ui/shadCN/tooltip';

// ===== SVG ICONS =====

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

export const getChevronIcon = (isExpanded: boolean, className?: string) => {
  return isExpanded ? 
    <ChevronDownIcon className={className} /> : 
    <ChevronRightIcon className={className} />;
};

export const getChevronIconComponent = (isExpanded: boolean) => {
  return isExpanded ? ChevronDownIcon : ChevronRightIcon;
};

// ===== CONSTANTS =====

export const ICON_SIZES = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4', 
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8'
} as const;

export type IconSize = keyof typeof ICON_SIZES;

// ===== EMOJI CONSTANTS =====

export const SPECIALIZATION_ICONS = {
  field: '🌱',
  winery: '🍷',
  administration: '📊',
  sales: '💼',
  maintenance: '🔧'
} as const;

export const getSpecializationIcon = (specialization: string): string => {
  return SPECIALIZATION_ICONS[specialization as keyof typeof SPECIALIZATION_ICONS] || '⭐';
};

export const EMOJI_OPTIONS: readonly string[] = [
  '📊', '🔧', '🍇', '🍷', '💼', '👥', '🌟', '⚡', '🎯', '🚀', 
  '💡', '🔥', '⭐', '🎪', '🏆', '🎨', '🎵', '🎮', '📱', '💻',
  '🏢', '🏭', '🌍', '🌱', '🌿', '🍃', '🌺', '🌻', '🌸', '🌷'
];

// Avatar options for user profiles
export const AVATAR_OPTIONS = [
  { id: 'default', emoji: '👤', label: 'Default' },
  { id: 'businessman', emoji: '👨‍💼', label: 'Businessman' },
  { id: 'businesswoman', emoji: '👩‍💼', label: 'Businesswoman' },
  { id: 'royal', emoji: '👑', label: 'Royal' },
  { id: 'superhero', emoji: '🦸', label: 'Superhero' },
  { id: 'ninja', emoji: '🥷', label: 'Ninja' },
  { id: 'sommelier', emoji: '🍷', label: 'Sommelier' },
  { id: 'winemaker', emoji: '🍇', label: 'Winemaker' },
  { id: 'farmer', emoji: '🚜', label: 'Farmer' }
];

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
  grapeSuitability: '🍇',
  overgrowthPenalty: '🌿',
  densityPenalty: '🌳'
} as const;

// ===== ASSET ICON COMPONENTS =====

// Characteristic Icon
export type CharacteristicName = keyof WineCharacteristics;

interface CharacteristicIconProps {
  name: CharacteristicName;
  size?: IconSize;
  className?: string;
  opacity?: number;
  rounded?: boolean;
  alt?: string;
  tooltip?: boolean | string | React.ReactNode;
}

export const CharacteristicIcon: React.FC<CharacteristicIconProps> = ({
  name,
  size = 'xs',
  className = '',
  opacity = 100,
  rounded = false,
  alt,
  tooltip = true
}) => {
  const sizeClass = ICON_SIZES[size];
  const roundedClass = rounded ? 'rounded-full' : '';
  // Use inline style for opacity (Tailwind doesn't support dynamic opacity classes)
  const style = opacity !== 100 ? { opacity: opacity / 100 } : undefined;
  
  const iconElement = (
    <img
      src={getCharacteristicIconSrc(name)}
      alt={alt || `${name} icon`}
      className={`${sizeClass} ${roundedClass} ${tooltip !== false ? 'cursor-help' : ''} ${className}`.trim()}
      style={style}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
  
  if (tooltip === false) {
    return iconElement;
  }
  
  const tooltipContent = tooltip === true ? getCharacteristicDisplayName(name) : tooltip;
  
  return (
    <UnifiedTooltip
      content={tooltipContent}
      side="top"
      variant="panel"
      density="compact"
    >
      {iconElement}
    </UnifiedTooltip>
  );
};

// Activity Icon
const getActivityIconFile = (category: WorkCategory): string => {
  return WORK_CATEGORY_INFO[category].icon;
};

interface ActivityIconProps {
  category: WorkCategory;
  size?: IconSize;
  className?: string;
  opacity?: number;
  rounded?: boolean;
  alt?: string;
  tooltip?: boolean | string | React.ReactNode;
}

export const ActivityIcon: React.FC<ActivityIconProps> = ({
  category,
  size = 'md',
  className = '',
  opacity = 100,
  rounded = true,
  alt,
  tooltip = true
}) => {
  const iconFile = getActivityIconFile(category);
  const sizeClass = ICON_SIZES[size];
  const roundedClass = rounded ? 'rounded-full' : '';
  // Use inline style for opacity (Tailwind doesn't support dynamic opacity classes)
  const style = opacity !== 100 ? { opacity: opacity / 100 } : undefined;
  
  const iconElement = (
    <img
      src={`/assets/icons/activities/${iconFile}`}
      alt={alt || `${category} icon`}
      className={`${sizeClass} ${roundedClass} ${tooltip !== false ? 'cursor-help' : ''} ${className}`.trim()}
      style={style}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
  
  if (tooltip === false) {
    return iconElement;
  }
  
  const tooltipContent = tooltip === true ? WORK_CATEGORY_INFO[category].displayName : tooltip;
  
  return (
    <UnifiedTooltip
      content={tooltipContent}
      side="top"
      variant="panel"
      density="compact"
    >
      {iconElement}
    </UnifiedTooltip>
  );
};

// Grape Icon
interface GrapeIconProps {
  variety: GrapeVariety;
  size?: IconSize;
  className?: string;
  opacity?: number;
  rounded?: boolean;
  alt?: string;
  tooltip?: boolean | string | React.ReactNode;
}

export const GrapeIcon: React.FC<GrapeIconProps> = ({
  variety,
  size = 'md',
  className = '',
  opacity = 100,
  rounded = false,
  alt,
  tooltip = true
}) => {
  const iconSrc = getGrapeIconSrc(variety);
  const sizeClass = ICON_SIZES[size];
  const roundedClass = rounded ? 'rounded-full' : '';
  // Use inline style for opacity (Tailwind doesn't support dynamic opacity classes)
  const style = opacity !== 100 ? { opacity: opacity / 100 } : undefined;
  
  const iconElement = (
    <img
      src={iconSrc}
      alt={alt || `${variety} icon`}
      className={`${sizeClass} ${roundedClass} ${tooltip !== false ? 'cursor-help' : ''} ${className}`.trim()}
      style={style}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
  
  if (tooltip === false) {
    return iconElement;
  }
  
  const tooltipContent = tooltip === true ? variety : tooltip;
  
  return (
    <UnifiedTooltip
      content={tooltipContent}
      side="top"
      variant="panel"
      density="compact"
    >
      {iconElement}
    </UnifiedTooltip>
  );
};

interface StoryPortraitProps {
  image?: string | null;
  alt?: string;
  className?: string;
  rounded?: boolean;
  fit?: 'cover' | 'contain';
  fallback?: string | null | false;
  onError?: (event: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export const StoryPortrait: React.FC<StoryPortraitProps> = ({
  image,
  alt = 'Story portrait',
  className,
  rounded = true,
  fit = 'cover',
  fallback,
  onError
}) => {
  const src = getStoryImageSrc(image, { fallback });
  if (!src) {
    return null;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn(
        'block',
        fit === 'cover' ? 'object-cover' : 'object-contain',
        rounded ? 'rounded-lg' : '',
        className
      )}
      onError={(event) => {
        event.currentTarget.style.display = 'none';
        if (onError) {
          onError(event);
        }
      }}
    />
  );
};
