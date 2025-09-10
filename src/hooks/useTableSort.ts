// Reusable table sorting hook for all tables in the application
import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig<T> {
  key: keyof T;
  direction: SortDirection;
}

export interface SortableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  accessor?: (item: T) => any; // Custom accessor for complex sorting
}

export function useTableSort<T>(data: T[], defaultSort?: SortConfig<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(defaultSort || null);

  // Sort function
  const sortedData = useMemo(() => {
    if (!sortConfig || sortConfig.direction === null) {
      return data;
    }

    return [...data].sort((a, b) => {
      const { key, direction } = sortConfig;
      
      let aValue: any = a[key];
      let bValue: any = b[key];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Convert to comparable values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      // Compare values
      let result = 0;
      if (aValue < bValue) {
        result = -1;
      } else if (aValue > bValue) {
        result = 1;
      }

      return direction === 'asc' ? result : -result;
    });
  }, [data, sortConfig]);

  // Handle sort column click
  const handleSort = (key: keyof T) => {
    let direction: SortDirection = 'asc';
    
    if (sortConfig && sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        direction = null; // Reset to no sort
      }
    }

    setSortConfig(direction ? { key, direction } : null);
  };

  // Get sort indicator for a column
  const getSortIndicator = (key: keyof T): string => {
    if (!sortConfig || sortConfig.key !== key) {
      return '↕️'; // Neutral sort indicator
    }
    
    switch (sortConfig.direction) {
      case 'asc':
        return '↑';
      case 'desc':
        return '↓';
      default:
        return '↕️';
    }
  };

  // Check if column is currently sorted
  const isColumnSorted = (key: keyof T): boolean => {
    return sortConfig !== null && sortConfig.key === key && sortConfig.direction !== null;
  };

  return {
    sortedData,
    sortConfig,
    handleSort,
    getSortIndicator,
    isColumnSorted,
    setSortConfig // For programmatic sorting
  };
}

// Utility function for complex sorting with custom accessors
export function useTableSortWithAccessors<T>(
  data: T[], 
  columns: SortableColumn<T>[], 
  defaultSort?: SortConfig<T>
) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(defaultSort || null);

  const sortedData = useMemo(() => {
    if (!sortConfig || sortConfig.direction === null) {
      return data;
    }

    const column = columns.find(col => col.key === sortConfig.key);
    if (!column) return data;

    return [...data].sort((a, b) => {
      const { direction } = sortConfig;
      
      // Use custom accessor if provided, otherwise use direct property access
      let aValue: any = column.accessor ? column.accessor(a) : a[sortConfig.key];
      let bValue: any = column.accessor ? column.accessor(b) : b[sortConfig.key];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Convert to comparable values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      // Compare values
      let result = 0;
      if (aValue < bValue) {
        result = -1;
      } else if (aValue > bValue) {
        result = 1;
      }

      return direction === 'asc' ? result : -result;
    });
  }, [data, sortConfig, columns]);

  // Handle sort column click
  const handleSort = (key: keyof T) => {
    const column = columns.find(col => col.key === key);
    if (!column || column.sortable === false) return; // Don't sort non-sortable columns

    let direction: SortDirection = 'asc';
    
    if (sortConfig && sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        direction = null;
      }
    }

    setSortConfig(direction ? { key, direction } : null);
  };

  // Get sort indicator for a column
  const getSortIndicator = (key: keyof T): string => {
    const column = columns.find(col => col.key === key);
    if (!column || column.sortable === false) return '';

    if (!sortConfig || sortConfig.key !== key) {
      return '↕️';
    }
    
    switch (sortConfig.direction) {
      case 'asc':
        return '↑';
      case 'desc':
        return '↓';
      default:
        return '↕️';
    }
  };

  // Check if column is currently sorted
  const isColumnSorted = (key: keyof T): boolean => {
    return sortConfig !== null && sortConfig.key === key && sortConfig.direction !== null;
  };

  return {
    sortedData,
    sortConfig,
    handleSort,
    getSortIndicator,
    isColumnSorted,
    setSortConfig
  };
}
