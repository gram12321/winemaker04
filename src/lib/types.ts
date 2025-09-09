// Game Types and Interfaces

// Time System
export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';
export const SEASONS: Season[] = ['Spring', 'Summer', 'Fall', 'Winter'];
export const WEEKS_PER_SEASON = 12;
export const STARTING_WEEK = 1;
export const STARTING_SEASON: Season = 'Spring';
export const STARTING_YEAR = 2025;

// Game Date structure
export interface GameDate {
  week: number;
  season: Season;
  year: number;
}

export function formatGameDate(date: GameDate): string {
  return `Week ${date.week}, ${date.season} ${date.year}`;
}

// Game State
export interface GameState {
  // Time Management
  week: number;
  season: Season;
  currentYear: number;
  
  // Financial
  money: number;
  prestige: number;
  
  // Core systems (basic placeholders for now)
  vineyards: any[];
  wines: any[];
}

// Initial game state
export const initialGameState: GameState = {
  // Time
  week: STARTING_WEEK,
  season: STARTING_SEASON,
  currentYear: STARTING_YEAR,
  
  // Financial
  money: 10000000, // €10M starting capital like in old version
  prestige: 1,
  
  // Systems
  vineyards: [],
  wines: []
};
