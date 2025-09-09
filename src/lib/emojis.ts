// Emoji mappings for the winery management game

export const NAVIGATION_EMOJIS = {
  dashboard: '🏠',
  vineyard: '🍇',
  winery: '🏭',
  sales: '🍷',
  finance: '💰'
} as const;

export const STATUS_EMOJIS = {
  time: '📅',
  money: '💰',
  prestige: '⭐',
  wine: '🍷',
  grape: '🍇',
  building: '🏭',
  field: '🌾',
  season: {
    Spring: '🌸',
    Summer: '☀️',
    Fall: '🍂',
    Winter: '❄️'
  }
} as const;

export const QUALITY_EMOJIS = {
  poor: '😞',
  fair: '😐',
  good: '😊',
  excellent: '🤩',
  perfect: '👑'
} as const;

export const SEASON_EMOJIS = {
  Spring: '🌸',
  Summer: '☀️',
  Fall: '🍂',
  Winter: '❄️'
} as const;
