// Centralized game state and logic
// This file will contain all game data and business logic

export interface GameState {
  // Player/Winery Info
  playerName: string
  wineryName: string
  money: number
  prestige: number
  
  // Game Progress
  currentDay: number
  gameSpeed: number
  
  // Vineyard Management
  fields: Field[]
  
  // Wine Production
  wines: Wine[]
  
  // Staff (Future implementation)
  staff: Staff[]
  
  // Buildings (Future implementation)
  buildings: Building[]
}

export interface Field {
  id: string
  name: string
  size: number // in acres
  health: number // 0-1 scale
  grapeVariety: string | null
  plantedDate: Date | null
  harvestDate: Date | null
  soilQuality: number // 0-1 scale
  altitude: number
  aspect: 'north' | 'south' | 'east' | 'west'
}

export interface Wine {
  id: string
  name: string
  grapeVariety: string
  vintage: number
  quality: number // 0-1 scale
  quantity: number // bottles
  price: number
  characteristics: WineCharacteristics
}

export interface WineCharacteristics {
  sweetness: number // 0-1 scale
  acidity: number // 0-1 scale
  tannins: number // 0-1 scale
  body: number // 0-1 scale
  spice: number // 0-1 scale
  aroma: number // 0-1 scale
}

export interface Staff {
  id: string
  name: string
  role: 'vineyard_worker' | 'winemaker' | 'sales' | 'manager'
  skill: number // 0-1 scale
  wage: number
  hiredDate: Date
}

export interface Building {
  id: string
  name: string
  type: 'winery' | 'storage' | 'office' | 'tasting_room'
  level: number
  capacity: number
  maintenanceCost: number
}

// Initial game state
export const initialGameState: GameState = {
  playerName: 'New Winemaker',
  wineryName: 'Your Winery',
  money: 100000, // Starting capital
  prestige: 0,
  currentDay: 1,
  gameSpeed: 1,
  fields: [],
  wines: [],
  staff: [],
  buildings: []
}

// Game logic functions will be added here
export const gameLogic = {
  // Field management
  plantField: (fieldId: string, grapeVariety: string) => {
    // Implementation will be added
  },
  
  // Wine production
  produceWine: (fieldId: string, quantity: number) => {
    // Implementation will be added
  },
  
  // Financial calculations
  calculateWinePrice: (wine: Wine) => {
    // Formula-based pricing
    return wine.quality * 50 + wine.characteristics.body * 20
  }
}
