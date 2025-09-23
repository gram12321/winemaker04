import React from 'react';
import { Activity } from '@/lib/types/activity';
import { WorkCategory } from '@/lib/services/work';
import { Button } from '@/components/ui/shadCN/button';
import { Progress } from '@/components/ui/shadCN/progress';
import { Badge } from '@/components/ui/shadCN/badge';
import { formatNumber } from '@/lib/utils/utils';

interface ActivityCardProps {
  activity: Activity;
  progress: number; // 0-100
  timeRemaining: string;
  onCancel?: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  dragAttributes?: any; // @dnd-kit attributes
  dragListeners?: any; // @dnd-kit listeners
}

// Color mapping for different work categories
const getCategoryColor = (category: WorkCategory): string => {
  const colors: Record<WorkCategory, string> = {
    [WorkCategory.PLANTING]: 'border-l-green-500',
    [WorkCategory.HARVESTING]: 'border-l-yellow-500',
    [WorkCategory.CLEARING]: 'border-l-orange-500',
    [WorkCategory.UPROOTING]: 'border-l-red-500',
    [WorkCategory.ADMINISTRATION]: 'border-l-blue-500',
    [WorkCategory.BUILDING]: 'border-l-gray-500',
    [WorkCategory.UPGRADING]: 'border-l-purple-500',
    [WorkCategory.MAINTENANCE]: 'border-l-gray-600',
    [WorkCategory.CRUSHING]: 'border-l-purple-600',
    [WorkCategory.FERMENTATION]: 'border-l-wine',
    [WorkCategory.STAFF_SEARCH]: 'border-l-indigo-500',
  };
  return colors[category] || 'border-l-gray-400';
};

// Get icon for work category
const getCategoryIcon = (category: WorkCategory): string => {
  const iconMap: Record<WorkCategory, string> = {
    [WorkCategory.PLANTING]: 'icon_planting.webp',
    [WorkCategory.HARVESTING]: 'icon_harvesting.webp',
    [WorkCategory.CLEARING]: 'icon_clearing.webp',
    [WorkCategory.UPROOTING]: 'icon_uprooting.webp',
    [WorkCategory.ADMINISTRATION]: 'icon_administration.webp',
    [WorkCategory.BUILDING]: 'icon_building.webp',
    [WorkCategory.UPGRADING]: 'icon_upgrade.webp',
    [WorkCategory.MAINTENANCE]: 'icon_maintenance.webp',
    [WorkCategory.CRUSHING]: 'icon_crushing.webp',
    [WorkCategory.FERMENTATION]: 'icon_fermentation.webp',
    [WorkCategory.STAFF_SEARCH]: 'icon_hiring.webp',
  };
  return iconMap[category] || 'icon_administration.webp';
};

// Format category display name
const getCategoryDisplayName = (category: WorkCategory): string => {
  const displayNames: Record<WorkCategory, string> = {
    [WorkCategory.PLANTING]: 'Planting',
    [WorkCategory.HARVESTING]: 'Harvesting',
    [WorkCategory.CLEARING]: 'Clearing',
    [WorkCategory.UPROOTING]: 'Uprooting',
    [WorkCategory.ADMINISTRATION]: 'Administration',
    [WorkCategory.BUILDING]: 'Building',
    [WorkCategory.UPGRADING]: 'Upgrading',
    [WorkCategory.MAINTENANCE]: 'Maintenance',
    [WorkCategory.CRUSHING]: 'Crushing',
    [WorkCategory.FERMENTATION]: 'Fermentation',
    [WorkCategory.STAFF_SEARCH]: 'Staff Search',
  };
  return displayNames[category] || category;
};

/**
 * ActivityCard - Individual activity display component
 * Features:
 * - Minimized/expanded view toggle (click anywhere on card)
 * - Drag handle for reordering (top-left corner)
 * - Cancel button (top-right corner, if cancellable)
 * - Real-time progress tracking
 * - Category-specific styling and icons
 */
export const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  progress,
  timeRemaining,
  onCancel,
  isMinimized = false,
  onToggleMinimize,
  dragAttributes,
  dragListeners
}) => {
  const categoryColor = getCategoryColor(activity.category);
  const categoryIcon = getCategoryIcon(activity.category);
  const categoryDisplayName = getCategoryDisplayName(activity.category);

  return (
    <div 
      className={`bg-gray-800 rounded-lg border-l-4 ${categoryColor} mb-3 shadow-md cursor-pointer hover:bg-gray-750 transition-colors relative`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onToggleMinimize) {
          onToggleMinimize();
        }
      }}
      title={isMinimized ? 'Click to expand' : 'Click to minimize'}
    >
      {/* Drag handle - positioned absolutely in top-left corner */}
      <div 
        className="absolute top-2 left-2 cursor-grab active:cursor-grabbing p-1 hover:bg-gray-700 rounded z-10"
        title="Drag to reorder"
        {...dragAttributes}
        {...dragListeners}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" className="text-gray-500">
          <circle cx="2" cy="2" r="1"/>
          <circle cx="6" cy="2" r="1"/>
          <circle cx="10" cy="2" r="1"/>
          <circle cx="2" cy="6" r="1"/>
          <circle cx="6" cy="6" r="1"/>
          <circle cx="10" cy="6" r="1"/>
          <circle cx="2" cy="10" r="1"/>
          <circle cx="6" cy="10" r="1"/>
          <circle cx="10" cy="10" r="1"/>
        </svg>
      </div>

      {/* Cancel button - positioned absolutely in top-right corner */}
      {activity.isCancellable && onCancel && (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }}
          className="absolute top-2 right-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 z-10 h-6 w-6 p-0"
          title="Cancel activity"
        >
          ✕
        </Button>
      )}

      {/* Content */}
      <div className="p-4 pt-8">

        {isMinimized ? (
          /* Minimized view - compact display */
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <img 
                src={`/assets/icons/${categoryIcon}`}
                alt={categoryDisplayName}
                className="w-4 h-4 rounded-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="text-white text-sm truncate">{activity.params.targetName || activity.targetId}</span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        ) : (
          /* Full view */
          <div>
            {/* Header with icon and badge */}
            <div className="flex items-center space-x-2 mb-3">
              <img 
                src={`/assets/icons/${categoryIcon}`}
                alt={categoryDisplayName}
                className="w-6 h-6 rounded-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <Badge variant="secondary" className="text-xs">
                {categoryDisplayName}
              </Badge>
            </div>

            {/* Activity title */}
            <h3 className="text-white font-medium mb-1">
              {activity.title}
            </h3>

            {/* Staff display */}
            <div className="flex items-center space-x-1 mb-2">
              <span className="text-gray-400 text-xs">👥 [None]</span>
            </div>

            {/* Progress bar */}
            <div className="mb-2">
              <Progress value={progress} className="h-2" />
            </div>

            {/* Progress info */}
            <div className="flex justify-between items-center text-xs text-gray-400">
              <span>{Math.round(progress)}% complete</span>
              <span>{formatNumber(activity.totalWork - activity.completedWork, { decimals: 0 })} work left</span>
            </div>

            {/* Time remaining */}
            <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
              <span>ETA: {timeRemaining}</span>
              <span>{formatNumber(activity.completedWork, { decimals: 0 })} / {formatNumber(activity.totalWork, { decimals: 0 })}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
