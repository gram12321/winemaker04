// Barrel export for hooks to reduce import duplication

// Game state hooks
export { useGameState, useGameStateWithData } from './useGameState';
export { useGameUpdates } from './useGameUpdates';
export { useGameInit } from './useGameInit';
export { usePrestigeUpdates } from './usePrestigeUpdates';

// Utility hooks
export { useLoadingState } from './useLoadingState';
export { useTableSortWithAccessors } from './useTableSort';

// Type exports
export type { SortableColumn } from './useTableSort';
