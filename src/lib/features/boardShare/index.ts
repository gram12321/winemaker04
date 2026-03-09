import type { BoardShareFeature } from './featureTypes';
import { noBoardShareFeature } from './noop';

let boardShareFeature: BoardShareFeature = noBoardShareFeature;

export function configureBoardShareFeature(feature: BoardShareFeature): void {
  boardShareFeature = feature;
}

export function getBoardShareFeature(): BoardShareFeature {
  return boardShareFeature;
}
