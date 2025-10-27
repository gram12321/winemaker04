import React, { memo, useState } from 'react';
import { Activity } from '@/lib/types/types';
import { Button } from '@/components/ui/shadCN/button';
import { Progress } from '@/components/ui/shadCN/progress';
import { Badge } from '@/components/ui/shadCN/badge';
import { StaffAssignmentModal } from '@/components/ui/modals/activitymodals/StaffAssignmentModal';
import { formatNumber } from '@/lib/utils/utils';
import { getSkillColor } from '@/lib/utils/colorMapping';
import { WORK_CATEGORY_INFO } from '@/lib/constants/activityConstants';
import { getTeamForCategory } from '@/lib/services';

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

/**
 * ActivityCard - Individual activity display component
 * Features:
 * - Minimized/expanded view toggle (click anywhere on card)
 * - Drag handle for reordering (top-left corner)
 * - Cancel button (top-right corner, if cancellable)
 * - Real-time progress tracking
 * - Category-specific styling and icons
 */
export const ActivityCard: React.FC<ActivityCardProps> = memo(({
  activity,
  progress,
  timeRemaining,
  onCancel,
  isMinimized = false,
  onToggleMinimize,
  dragAttributes,
  dragListeners
}) => {
  const [showStaffModal, setShowStaffModal] = useState(false);
  
  const categoryInfo = WORK_CATEGORY_INFO[activity.category];

  // Resolve unified color from SKILL_COLORS via category → relevant skill mapping
  const relevantSkillForCategory = categoryInfo.skill;
  const categoryBorderHex = getSkillColor(relevantSkillForCategory);
  
  // Get assigned staff count
  const assignedStaffIds = activity.params.assignedStaffIds || [];
  const assignedStaffCount = Array.isArray(assignedStaffIds) ? assignedStaffIds.length : 0;
  
  // Get the team that auto-assigns to this activity
  const defaultTeam = getTeamForCategory(activity.category);
  const teamMemberCount = defaultTeam?.memberIds.length || 0;

  return (
    <>
    <div 
      className={`bg-gray-800 rounded-lg border-l-4 mb-3 shadow-md cursor-pointer hover:bg-gray-750 transition-colors relative`}
      style={{ borderLeftColor: categoryBorderHex }}
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
                src={`/assets/icons/${categoryInfo.icon}`}
                alt={categoryInfo.displayName}
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
                src={`/assets/icons/${categoryInfo.icon}`}
                alt={categoryInfo.displayName}
                className="w-6 h-6 rounded-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <Badge variant="secondary" className="text-xs">
                {categoryInfo.displayName}
              </Badge>
            </div>

            {/* Activity title */}
            <h3 className="text-white font-medium mb-1">
              {activity.title}
            </h3>

            {/* Staff display and assign button */}
            <div className="flex items-center justify-between mb-2">
              <div 
                className="flex items-center space-x-1"
                title={defaultTeam ? `${defaultTeam.icon} Auto-assigns: ${defaultTeam.name} (${teamMemberCount} ${teamMemberCount === 1 ? 'member' : 'members'})` : undefined}
              >
                <span className={`text-xs ${assignedStaffCount > 0 ? 'text-gray-400' : 'text-red-400'}`}>
                  👥 {assignedStaffCount > 0 ? `${assignedStaffCount} staff` : 'No staff'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowStaffModal(true);
                }}
                className="text-xs h-6 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                title={defaultTeam ? `Assign staff to this activity\n\n${defaultTeam.icon} Auto-assigns: ${defaultTeam.name} (${teamMemberCount} ${teamMemberCount === 1 ? 'member' : 'members'})` : 'Assign staff to this activity'}
              >
                Assign
              </Button>
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
    
    {/* Staff Assignment Modal */}
    {showStaffModal && (
      <StaffAssignmentModal
        isOpen={showStaffModal}
        onClose={() => setShowStaffModal(false)}
        activity={activity}
      />
    )}
    </>
  );
});
