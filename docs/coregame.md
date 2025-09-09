# Core Game Mechanics - Winery Management Game

## 🎯 Overview
This document describes the basic core game mechanics for the Winery Management Game. The goal is to keep the initial implementation as simple as possible while establishing the foundation for more complex features later.

## 🏗️ Core Game Architecture

### Game State Management
- **Central State**: All game data managed in `src/lib/gameState.ts`
- **Time System**: Week-based progression (12 weeks per season, 4 seasons per year)
- **Data Persistence**: Supabase database for game state storage
- **Real-time Updates**: Supabase subscriptions for live game updates

## 🌱 Core Game Systems

### 1. Time Progression System
**Purpose**: Manage game time and seasonal activities

**Core Components**:
- **Game Time Interface**: `{ week: number, season: Season, year: number }`
- **Seasons**: Spring, Summer, Fall, Winter (12 weeks each)
- **Time Advancement**: Manual "Advance Time" button

**Seasonal Effects**:
- **Spring**: Vineyards wake from dormancy, planting season
- **Summer**: Grapes ripen (ripeness increases weekly)
- **Fall**: Harvest season, grapes ready for collection
- **Winter**: Dormancy, focus on wine production and sales

**Key Functions**:
- `incrementWeek()`: Advance time and process seasonal effects
- `onSeasonChange()`: Handle seasonal transitions
- `onNewYear()`: Update vineyard age and reset annual factors

### 2. Vineyard System
**Purpose**: Foundation for grape production and wine making

**Core Components**:
- **Vineyard Interface**: Represents individual vineyard plots
- **Properties**:
  - `id`, `name`, `country`, `region`, `acres`
  - `grape`: Grape variety (Chardonnay, Pinot Noir, etc.)
  - `vineAge`: Years since planting
  - `vineyardHealth`: Condition (0-1 scale)
  - `ripeness`: Harvest readiness (0-1 scale)
  - `status`: Current state (Growing, Ripening, Ready for Harvest, Dormancy)
  - `annualYieldFactor`: Random yearly variation
  - `annualQualityFactor`: Random yearly quality modifier

**Key Functions**:
- `createVineyard()`: Initialize new vineyard with random properties
- `plantVineyard()`: Plant grape variety with activity system
- `harvestVineyard()`: Collect grapes with storage validation
- `calculateVineyardYield()`: Determine harvest amount

**Yield Formula**:
```
Yield = BASE_YIELD_PER_ACRE × acres × qualityMultiplier × annualYieldFactor × densityModifier
qualityMultiplier = (ripeness + vineyardHealth) / 2
```

### 3. Inventory
**Purpose**: Manage grapes, must, and finished wine products

**Core Components**:
- **WineBatch Interface**: Tracks wine through production stages
- **Properties**:
  - `id`, `vineyardId`, `grapeType`, `quantity`, `quality`
  - `stage`: 'grape' → 'must' → 'wine' → 'bottled'
  - `storageLocations`: Array of storage vessels and quantities
  - `characteristics`: Wine properties (acidity, body, tannins, etc.)
  - `harvestGameDate`: When grapes were harvested
  - `ripeness`: Grape ripeness at harvest

**Key Functions**:
- `addWineBatch()`: Create from harvest with storage validation
- `updateWineBatch()`: Change stage or properties
- `validateStorage()`: Ensure proper storage capacity and type

**Storage Requirements**:
- Grapes: Storage tanks
- Must: Fermentation vessels  
- Wine: Barrels for aging
- Bottled: Bottle storage

### 4. Sales System
**Purpose**: Generate revenue from wine sales

**Core Components**:
- **Sales Interface**: Represents wine sales transactions
- **Properties**:
  - `id`, `wineId`, `quantity`, `pricePerUnit`, `totalValue`, `saleDate`

**Pricing Formula**:
```
Base Price = Quality × Wine Balance
Sell Value = Quantity × Base Price
```

**Key Functions**:
- `calculateWinePrice()`: Determine market value
- `sellWine()`: Execute sale transaction

## 🎮 User Interface Requirements

### Phase 1: Basic Interface
- **Time Display**: "Week X, Season Y, Year Z"
- **Advance Time Button**: Manual progression control
- **Vineyard List**: Show all owned vineyards with status
- **Create Vineyard Button**: Add new vineyard
- **Basic Dashboard**: Overview of vineyards and inventory

### Phase 2: Management Interface
- **Vineyard Details**: Plant, harvest, manage individual vineyards
- **Inventory Overview**: Show all wine batches by stage
- **Storage Management**: Allocate storage for harvests
- **Sales Interface**: List wines ready for sale with prices

## 🔄 Game Flow

### Basic Game Loop
1. **Time Management**: Player advances time
2. **Vineyard Care**: Monitor and maintain vineyards
3. **Harvest**: Collect grapes when ready (requires storage)
4. **Processing**: Convert grapes to wine (future feature)
5. **Sales**: Sell finished wine for profit (future feature)

## 🎯 Implementation Priority

### Phase 1: Core Foundation
1. **Game Constants**: Time system, vineyard constants, grape varieties
2. **Time System**: Week advancement with seasonal effects
3. **Vineyard Creation**: Basic vineyard generation and display
4. **Basic UI**: Time display, advance button, vineyard list

### Phase 2: Vineyard Operations
1. **Planting System**: Plant grape varieties with activity tracking
2. **Harvest System**: Collect grapes with storage validation
3. **Wine Batch Creation**: Convert harvest to wine batches
4. **Vineyard Management UI**: Plant, harvest, view details

### Phase 3: Production Chain
1. **Wine Processing**: Convert grapes to must to wine
2. **Storage System**: Manage storage vessels and capacity
3. **Quality System**: Track wine characteristics and aging
4. **Inventory UI**: Manage wine batches and storage

### Phase 4: Economic System
1. **Pricing System**: Calculate wine values
2. **Sales System**: Sell wine for profit
3. **Market Mechanics**: Basic demand and pricing variation
4. **Financial UI**: Track money, sales, profits

## 🔧 Technical Implementation Notes

### Proven Patterns from Old Iterations
- **Activity System**: Use work-based activities for planting/harvesting
- **Storage Validation**: Validate storage capacity before operations
- **Weighted Averages**: Combine multiple harvests intelligently
- **Seasonal Automation**: Automatic status changes based on seasons
- **Progress Tracking**: Show work progress for long operations

### Database Schema
- **vineyards**: All vineyard data with foreign keys
- **wine_batches**: Wine inventory with storage locations
- **game_state**: Time, money, and global state
- **sales**: Transaction history

### Component Structure
- `VineyardManager`: CRUD operations and vineyard logic
- `WineBatchManager`: Inventory and processing management
- `Dashboard`: Main game interface
