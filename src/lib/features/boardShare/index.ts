import type { BoardShareFeature } from './contracts';

let boardShareFeature: BoardShareFeature | null = null;

export function configureBoardShareFeature(feature: BoardShareFeature): void {
  boardShareFeature = feature;
}

export function getBoardShareFeature(): BoardShareFeature {
  if (!boardShareFeature) {
    throw new Error('Board/share feature is not configured');
  }
  return boardShareFeature;
}
