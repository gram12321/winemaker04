# Core Game Mechanics - Winery Management Game

## 🎯 Current Implementation Status

This document describes what has been **actually implemented** in the Winery Management Game as of version 0.0009.

## 🏗️ Core Game Architecture

### Game State Management ✅ **IMPLEMENTED**
- **Central State**: `src/lib/gameState.ts` - manages time, money, prestige
- **Time System**: Week-based progression (manual advancement only)
- **Data Persistence**: `src/lib/database.ts` - Supabase integration
- **Real-time Updates**: `src/hooks/useGameUpdates.ts` - Supabase subscriptions

## 🌱 Core Game Systems

### 1. Time Progression System ✅ **IMPLEMENTED**
**What's Implemented**:
- **Game Time Interface**: `{ week: number, season: Season, year: number }` in `src/lib/types.ts`
- **Seasons**: Spring, Summer, Fall, Winter (12 weeks each)
- **Time Advancement**: Manual "Advance Time" button in `src/components/layout/Header.tsx`
- **Function**: `incrementWeek()` in `src/lib/gameState.ts` - handles week/season/year progression
- **Automatic Season Changes**: Every 12 weeks, season advances (Spring→Summer→Fall→Winter→Spring)
- **Automatic Year Changes**: When returning to Spring, year increments

**What's NOT Implemented**:
- ❌ **Seasonal Effects**: No automatic seasonal effects on vineyards/wine
- ❌ **onSeasonChange()**: Function not implemented (no seasonal event handling)
- ❌ **onNewYear()**: Function not implemented (no yearly event handling)
- ❌ **Automatic Progression**: Time only advances manually (no auto-advance)

### 2. Vineyard System ✅ **IMPLEMENTED**
**What's Implemented**:
- **Vineyard Interface**: `src/lib/types.ts` - Complete vineyard interface
- **Vineyard Service**: `src/lib/services/vineyardService.ts` - CRUD operations
- **Properties**: `id`, `name`, `country`, `region`, `hectares`, `grape`, `isPlanted`, `status`, `createdAt`
- **Status Types**: `'Barren' | 'Planted' | 'Growing' | 'Harvested' | 'Dormant'`
- **Key Functions**:
  - `createVineyard()`: Create new vineyard (defaults: France/Bordeaux, 0.5 hectares)
  - `plantVineyard()`: Plant grape varieties (sets isPlanted=true, status='Planted')
  - `growVineyard()`: Change status from 'Planted' to 'Growing'
  - `harvestVineyard()`: Collect grapes and create wine batches
- **UI**: `src/components/pages/Vineyard.tsx` - Complete vineyard management interface

**What's NOT Implemented**:
- ❌ **Advanced Properties**: `vineAge`, `vineyardHealth`, `ripeness`, `annualYieldFactor`, `annualQualityFactor`
- ❌ **Complex Yield Formula**: Basic yield calculation only
- ❌ **Status Automation**: Manual status changes only

### 3. Wine Production System ✅ **IMPLEMENTED**
**What's Implemented**:
- **WineBatch Interface**: `src/lib/types.ts` - Complete wine batch tracking
- **WineBatch Service**: `src/lib/services/wineBatchService.ts` - CRUD operations
- **Winery Service**: `src/lib/services/wineryService.ts` - Production operations
- **Properties**: `id`, `vineyardId`, `vineyardName`, `grape`, `quantity`, `stage`, `process`, `fermentationProgress`, `quality`, `balance`, `finalPrice`, `harvestDate`, `createdAt`, `completedAt`
- **Dual Tracking System**:
  - **Stage**: `'grapes' | 'must' | 'wine' | 'bottled'` (material state)
  - **Process**: `'none' | 'fermentation' | 'aging' | 'bottled'` (current activity)
- **Key Functions**:
  - `createWineBatchFromHarvest()`: Create from harvest with quality/balance calculation
  - `crushGrapes()`: Convert grapes to must (stage: grapes→must)
  - `startFermentation()`: Begin fermentation (process: none→fermentation)
  - `stopFermentation()`: Complete fermentation (stage: must→wine, process: fermentation→aging)
  - `bottleWine()`: Complete production (stage: wine→bottled, process: aging→bottled)
  - `progressFermentation()`: Manual fermentation progress control
- **UI**: `src/components/pages/Winery.tsx` - Complete winery operations interface

**What's NOT Implemented**:
- ❌ **Storage Locations**: No detailed storage vessel tracking
- ❌ **Wine Characteristics**: No acidity, body, tannins tracking (only quality/balance)
- ❌ **Storage Validation**: Basic validation only

### 4. Sales System ✅ **IMPLEMENTED**
**What's Implemented**:
- **Sales Service**: `src/lib/services/salesService.ts` - Complete sales system
- **Calculator Service**: `src/lib/utils/calculator.ts` - Advanced pricing algorithms
- **WineOrder Interface**: `src/lib/types.ts` - Order management
- **Properties**: `id`, `orderedAt`, `orderType`, `wineBatchId`, `wineName`, `requestedQuantity`, `offeredPrice`, `totalValue`, `status`
- **Customer Types**: `'Local Restaurant' | 'Wine Shop' | 'Private Collector' | 'Export Order'`
- **Order Configurations**: Each customer type has different price multipliers, quantity ranges, and generation chances
- **Key Functions**:
  - `generateWineOrder()`: Create random orders for bottled wines
  - `fulfillWineOrder()`: Execute sales and create transactions
  - `rejectWineOrder()`: Decline orders
  - `getWineBasePrice()`: Get stored wine price
  - `recalculateWineBasePrice()`: Recalculate pricing
- **UI**: `src/components/pages/Sales.tsx` - Complete sales interface

**What's NOT Implemented**:
- ❌ **Market Mechanics**: No demand/pricing variation over time
- ❌ **Contract System**: No long-term contracts

### 5. Finance System ✅ **IMPLEMENTED**
**What's Implemented**:
- **Finance Service**: `src/lib/services/financeService.ts` - Complete transaction management
- **Financial UI**: `src/components/finance/` - Income statements, balance sheets, cash flow
- **Transaction System**: All money flows tracked with audit trail
- **Asset Valuation**: Basic calculation of vineyard (€10k/acre), wine (stage×quality×price), and grape values
- **Integration**: Sales and admin tools use transaction system

**What's NOT Implemented**:
- ❌ **Buildings Value**: Always shows €0 (placeholder)
- ❌ **Advanced Asset Valuation**: No market fluctuations, depreciation, or sophisticated pricing

### 6. Player Interface ✅ **PARTIALLY IMPLEMENTED**
**What's Implemented**:
- **Navigation**: `src/components/layout/Header.tsx` - Time display, advance button, player menu
- **Player Menu**: Dropdown with Profile, Settings, Admin Dashboard, Achievements, Winepedia
- **Notification System**: `src/components/layout/NotificationCenter.tsx` - Toast notifications
- **Admin Dashboard**: `src/components/pages/AdminDashboard.tsx` - Data management tools
- **Settings**: `src/components/pages/Settings.tsx` - Basic notification preferences
- **Winepedia**: `src/components/pages/Winepedia.tsx` - Grape variety information

**What's NOT Implemented**:
- ❌ **Profile**: `src/components/pages/Profile.tsx` - Just placeholder "coming soon"
- ❌ **Achievements**: `src/components/pages/Achievements.tsx` - Just placeholder "coming soon"

## 🎯 **Implementation Status Summary**

### ✅ **COMPLETED SYSTEMS**
- **Time Progression**: Manual week advancement (no seasonal effects)
- **Vineyard Management**: Create, plant, harvest vineyards
- **Wine Production**: Complete grapes → must → wine → bottled pipeline
- **Sales System**: Order generation, fulfillment, sophisticated pricing
- **Finance System**: Transaction tracking, financial reporting, asset valuation
- **Player Interface**: Navigation, notifications, admin tools

### ❌ **NOT IMPLEMENTED**
- **Seasonal Effects**: No automatic seasonal changes
- **Advanced Vineyard Properties**: Health, ripeness, age tracking
- **Wine Characteristics**: Acidity, body, tannins, etc.
- **Storage Management**: Detailed vessel tracking
- **Market Mechanics**: Dynamic pricing/demand
- **Contract System**: Long-term sales contracts

## 🔧 **Technical Architecture**

### Database Schema ✅ **IMPLEMENTED**
- **vineyards**: Vineyard data with foreign keys
- **wine_batches**: Wine inventory with stage tracking
- **game_state**: Time, money, and global state
- **wine_orders**: Sales order management
- **transactions**: Financial transaction history

### Component Structure ✅ **IMPLEMENTED**
- **Services**: `src/lib/services/` - Business logic separation
- **UI Components**: `src/components/` - React components with ShadCN
- **Hooks**: `src/hooks/` - State management and data loading
- **Utils**: `src/lib/utils/` - Helper functions and calculations
