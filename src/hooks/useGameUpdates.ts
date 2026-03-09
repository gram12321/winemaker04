// Custom hook for triggering game state updates across components
import { useCallback } from 'react';
import {
  subscribeGameUpdates,
  subscribeTopicUpdates,
  triggerGameUpdate,
  triggerGameUpdateImmediate,
  triggerTopicUpdate
} from '@/lib/services/core/gameUpdateBus';

export const useGameUpdates = () => {
  const subscribe = useCallback((callback: () => void) => {
    return subscribeGameUpdates(callback);
  }, []);

  const subscribeTopic = useCallback((topic: string, callback: () => void) => {
    return subscribeTopicUpdates(topic, callback);
  }, []);

  return { subscribe, subscribeTopic };
};

export { triggerGameUpdate, triggerGameUpdateImmediate, triggerTopicUpdate };
