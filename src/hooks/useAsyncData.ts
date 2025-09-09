// Custom hook for loading async data with automatic updates
import { useState, useEffect } from 'react';
import { useGameUpdates } from './useGameUpdates';

export function useAsyncData<T>(
  loadData: () => Promise<T>,
  initialValue: T
): T {
  const [data, setData] = useState<T>(initialValue);
  const { subscribe } = useGameUpdates();

  useEffect(() => {
    const refreshData = async () => {
      const newData = await loadData();
      setData(newData);
    };

    refreshData();

    // Subscribe to global updates
    const unsubscribe = subscribe(() => {
      refreshData();
    });

    return () => {
      unsubscribe();
    };
  }, [loadData, subscribe]);

  return data;
}
