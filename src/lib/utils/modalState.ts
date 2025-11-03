/**
 * Global state management for modal minimize functionality
 * Tracks which modals are minimized to prevent time advancement
 */

type ModalType = 'land' | 'staff' | 'lender' | 'loan';

const minimizedModals = new Set<ModalType>();
const restoreCallbacks = new Map<ModalType, () => void>();

/**
 * Check if any modal is currently minimized
 */
export const hasMinimizedModals = (): boolean => {
  return minimizedModals.size > 0;
};

/**
 * Mark a modal as minimized and register restore callback
 */
export const setModalMinimized = (type: ModalType, minimized: boolean, restoreCallback?: () => void): void => {
  if (minimized) {
    minimizedModals.add(type);
    if (restoreCallback) {
      restoreCallbacks.set(type, restoreCallback);
    }
  } else {
    minimizedModals.delete(type);
    restoreCallbacks.delete(type);
  }
};

/**
 * Check if a specific modal is minimized
 */
export const isModalMinimized = (type: ModalType): boolean => {
  return minimizedModals.has(type);
};

/**
 * Get all minimized modal types
 */
export const getMinimizedModals = (): ModalType[] => {
  return Array.from(minimizedModals);
};

/**
 * Restore a specific modal
 */
export const restoreModal = (type: ModalType): void => {
  const callback = restoreCallbacks.get(type);
  if (callback) {
    callback();
  }
  minimizedModals.delete(type);
  restoreCallbacks.delete(type);
};

/**
 * Restore all minimized modals
 */
export const restoreAllMinimizedModals = (): void => {
  const modalsToRestore = Array.from(minimizedModals);
  modalsToRestore.forEach((type) => {
    restoreModal(type);
  });
};

/**
 * Clear all minimized modals (e.g., on close)
 */
export const clearAllMinimizedModals = (): void => {
  minimizedModals.clear();
  restoreCallbacks.clear();
};

