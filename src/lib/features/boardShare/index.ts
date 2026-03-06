import type { BoardShareFeature } from './contracts';
import { activeBoardShareRuntimeFeature } from './runtime';

const noUiBoardShareHooks: BoardShareFeature['ui'] = {
  getFinanceTabs: () => [],
  getWinepediaTabs: () => []
};

let boardShareFeature: BoardShareFeature = {
  ...activeBoardShareRuntimeFeature,
  ui: noUiBoardShareHooks
};

export function configureBoardShareFeature(feature: BoardShareFeature): void {
  boardShareFeature = feature;
}

export function getBoardShareFeature(): BoardShareFeature {
  return boardShareFeature;
}
