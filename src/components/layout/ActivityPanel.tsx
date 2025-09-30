import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/shadCN/button';
import { ChevronLeft, Minimize2, Maximize2, X } from 'lucide-react';
import { ActivityCard } from '@/components/ui/activities/ActivityCard';
import { Activity } from '@/lib/types/types';
import { getAllActivities, getActivityProgress, cancelActivity } from '@/lib/services/activity/activityManager';
import { useGameStateWithData } from '@/hooks';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type PanelState = 'hidden' | 'minimized' | 'full';
type MobileState = 'closed' | 'open';

/**
 * ActivityPanel - Centralized sidebar for managing game activities
 * Features:
 * - Drag & drop reordering with @dnd-kit
 * - Individual card minimize/expand
 * - Real-time progress tracking
 * - Three panel states: hidden, minimized, full
 */
export const ActivityPanel: React.FC = () => {
  // Panel state management
  const [panelState, setPanelState] = useState<PanelState>('full');
  const [mobileState, setMobileState] = useState<MobileState>('closed');
  const [minimizedCards, setMinimizedCards] = useState<Set<string>>(new Set());
  const [orderedActivityIds, setOrderedActivityIds] = useState<string[]>([]);
  const [activityProgresses, setActivityProgresses] = useState<Record<string, { progress: number; timeRemaining: string }>>({});

  // Drag & drop configuration
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load activities from database via game state hook
  const activities = useGameStateWithData(getAllActivities, []);

  useEffect(() => {
    // Initialize or update ordered IDs
    const currentIds = activities.map(a => a.id);
    setOrderedActivityIds(prev => {
      // Keep existing order for activities that still exist
      const existingOrder = prev.filter(id => currentIds.includes(id));
      // Add new activities to the end
      const newIds = currentIds.filter(id => !prev.includes(id));
      return [...existingOrder, ...newIds];
    });
  }, [activities]);

  // Load progress for all activities
  useEffect(() => {
    const loadProgresses = async () => {
      const progresses: Record<string, any> = {};
      await Promise.all(activities.map(async (activity) => {
        const progress = await getActivityProgress(activity.id);
        if (progress) {
          progresses[activity.id] = progress;
        }
      }));
      setActivityProgresses(progresses);
    };

    if (activities.length > 0) {
      loadProgresses();
    }
  }, [activities]);

  // Event handlers
  const handleCancelActivity = async (activityId: string) => {
    try {
      await cancelActivity(activityId);
      // useGameStateWithData hook automatically refreshes activities
    } catch (error) {
      console.error('Error in handleCancelActivity:', error);
    }
  };

  const handleTogglePanel = () => {
    const states: PanelState[] = ['hidden', 'minimized', 'full'];
    const currentIndex = states.indexOf(panelState);
    const nextIndex = (currentIndex + 1) % states.length;
    setPanelState(states[nextIndex]);
  };

  const handleToggleMobile = () => {
    setMobileState(prev => prev === 'open' ? 'closed' : 'open');
  };

  const handleToggleCardMinimize = (activityId: string) => {
    setMinimizedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(activityId)) {
        newSet.delete(activityId);
      } else {
        newSet.add(activityId);
      }
      return newSet;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedActivityIds((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Utility functions
  const getToggleIcon = () => {
    switch (panelState) {
      case 'hidden': return <ChevronLeft className="h-4 w-4" />;
      case 'minimized': return <Maximize2 className="h-4 w-4" />;
      case 'full': return <Minimize2 className="h-4 w-4" />;
    }
  };

  const getToggleTooltip = () => {
    switch (panelState) {
      case 'hidden': return 'Show Activities';
      case 'minimized': return 'Expand Activities';
      case 'full': return 'Minimize Activities';
    }
  };

  const getOrderedActivities = () => {
    const activityMap = new Map(activities.map(a => [a.id, a]));
    return orderedActivityIds
      .map(id => activityMap.get(id))
      .filter(Boolean) as Activity[];
  };

  // Mobile floating button (always visible on mobile)
  const MobileFloatingButton = () => (
    <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-50 lg:hidden">
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggleMobile}
        title="Open Activities"
        className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
      >
        <span className="mr-1">📋</span>
        {activities.length}
      </Button>
    </div>
  );

  // Desktop panel (hidden on mobile)
  const DesktopPanel = () => {
    if (panelState === 'hidden') {
      return (
        <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-50 hidden lg:block">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTogglePanel}
            title={getToggleTooltip()}
            className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
          >
            {getToggleIcon()}
          </Button>
        </div>
      );
    }

    return (
      <div className={`fixed right-0 top-0 h-screen z-40 transition-all duration-300 hidden lg:block ${
      panelState === 'minimized' ? 'w-8' : 'w-56'
    }`}>
      <div className="bg-gray-900 h-screen border-l border-gray-700 shadow-xl text-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-2.5 border-b border-gray-700">
          {panelState === 'full' && (
            <h2 className="text-white font-semibold">Activity Panel</h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTogglePanel}
            title={getToggleTooltip()}
            className="text-gray-400 hover:text-white hover:bg-gray-800"
          >
            {getToggleIcon()}
          </Button>
        </div>

        {/* Content */}
        <div className="p-2 overflow-y-auto h-[calc(100vh-44px)] pb-2">
          {panelState === 'full' ? (
            <>
              {activities.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <p>No active activities</p>
                  <p className="text-sm mt-2">Start planting or other activities to see progress here</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={orderedActivityIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {getOrderedActivities().map((activity) => {
                        const progress = activityProgresses[activity.id];
                        const isMinimized = minimizedCards.has(activity.id);
                        return (
                          <SortableActivityCard
                            key={activity.id}
                            activity={activity}
                            progress={progress?.progress || 0}
                            timeRemaining={progress?.timeRemaining || 'Calculating...'}
                            onCancel={() => handleCancelActivity(activity.id)}
                            isMinimized={isMinimized}
                            onToggleMinimize={() => handleToggleCardMinimize(activity.id)}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </>
          ) : (
            // Minimized view - just show count
            <div className="flex flex-col items-center justify-center h-full">
              <div className="bg-gray-800 rounded-lg p-3 mb-3 text-center">
                <div className="text-white font-bold text-xl">
                  {activities.length}
                </div>
                <div className="text-gray-400 text-xs mt-1">
                  Active
                </div>
              </div>
              
              {/* Mini progress indicators */}
              <div className="w-full space-y-2">
                {activities.slice(0, 3).map((activity) => {
                  const progress = activityProgresses[activity.id];
                  return (
                    <div key={activity.id} className="w-full">
                      <div className="w-full bg-gray-700 rounded-full h-1">
                        <div 
                          className="bg-green-500 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${progress?.progress || 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                
                {activities.length > 3 && (
                  <div className="text-gray-500 text-xs text-center mt-2">
                    +{activities.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    );
  };

  // Mobile sliding panel
  const MobilePanel = () => {
    if (mobileState === 'closed') return null;

    return (
      <div className="fixed inset-0 z-50 lg:hidden">
        <div className="fixed inset-0 bg-black/50" onClick={() => setMobileState('closed')} />
        <div className="fixed top-0 right-0 bottom-0 w-3/4 max-w-sm bg-gray-900 p-6 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Activities</h2>
            <Button variant="ghost" size="icon" onClick={() => setMobileState('closed')}>
              <X className="h-6 w-6 text-white" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {activities.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <p>No active activities</p>
                <p className="text-sm mt-2">Start planting or other activities to see progress here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {getOrderedActivities().map((activity) => {
                  const progress = activityProgresses[activity.id];
                  return (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      progress={progress?.progress || 0}
                      timeRemaining={progress?.timeRemaining || 'Calculating...'}
                      onCancel={() => handleCancelActivity(activity.id)}
                      isMinimized={false}
                      onToggleMinimize={() => {}}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <MobileFloatingButton />
      <DesktopPanel />
      <MobilePanel />
    </>
  );
};

// Sortable wrapper component for ActivityCard
interface SortableActivityCardProps {
  activity: Activity;
  progress: number;
  timeRemaining: string;
  onCancel?: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

/**
 * SortableActivityCard - Wrapper component that adds drag-and-drop functionality to ActivityCard
 * Uses @dnd-kit/sortable to enable reordering of activity cards
 */
const SortableActivityCard: React.FC<SortableActivityCardProps> = ({
  activity,
  progress,
  timeRemaining,
  onCancel,
  isMinimized,
  onToggleMinimize
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      {...attributes}
    >
      <ActivityCard
        activity={activity}
        progress={progress}
        timeRemaining={timeRemaining}
        onCancel={onCancel}
        isMinimized={isMinimized}
        onToggleMinimize={onToggleMinimize}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  );
};
