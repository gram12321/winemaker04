export interface WineLogAchievementScoreSource {
  wineScore?: number;
}

export function resolveWineLogAchievementScore(entry: WineLogAchievementScoreSource): number {
  return typeof entry.wineScore === 'number' && Number.isFinite(entry.wineScore) ? entry.wineScore : 0;
}
