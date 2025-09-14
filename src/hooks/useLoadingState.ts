// Simplified loading state hook - just a useState wrapper
import { useState, useCallback } from 'react';

export interface UseLoadingStateReturn {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  withLoading: <T>(asyncFn: () => Promise<T>) => Promise<T | null>;
}

/**
 * Simplified loading state hook
 * Most components just need useState(false), but this provides withLoading for convenience
 */
export function useLoadingState(): UseLoadingStateReturn {
  const [isLoading, setIsLoading] = useState(false);

  const withLoading = useCallback(async <T>(asyncFn: () => Promise<T>): Promise<T | null> => {
    setIsLoading(true);
    try {
      return await asyncFn();
    } catch (error) {
      console.error('Error in async operation:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    setIsLoading,
    withLoading
  };
}
