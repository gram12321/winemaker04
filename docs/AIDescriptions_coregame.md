# Core Game Mechanics - Winery Management Game

## 🎯 Current Implementation Status

This document describes what has been **actually implemented** in the Winery Management Game as of version 0.0091b.

## 🏗️ Core Game Architecture

### Game State Management ✅ **IMPLEMENTED**
- **Central State**: `src/lib/services/core/gameState.ts` - manages time, money, prestige, company data
- **Time System**: Week-based progression (manual advancement only)
- **Data Persistence**: `src/lib/database/database.ts` - Supabase integration with company-scoped data
- **Real-time Updates**: `src/hooks/useGameUpdates.ts` - Supabase subscriptions
- **Company System**: Multi-company support with company switching and data isolation

## 🌱 Core Game Systems

### 1. Time Progression System ✅ **IMPLEMENTED**
**What's Implemented**:
- **Game Time**: `{ week, season, year }` interface with automatic season (every 12 weeks) and year changes. in `src/lib/types/types.ts`
- **Function**: `processGameTick()` in `src/lib/services/core/gameTick.ts` - handles week/season/year progression
- **Game Tick System**: Weekly order generation, activity progression, vine aging, prestige updates

**What's NOT Implemented**:
- ❌ **Seasonal Effects**: No automatic seasonal effects on vineyards/wine

### 2. Vineyard System ✅ **IMPLEMENTED**
**What's Implemented**:
- **Vineyard Interface**: `src/lib/types/types.ts` - Complete vineyard interface with advanced properties
- **Vineyard Service**: `src/lib/services/wine/vineyardService.ts` - CRUD operations
- **Land Buying System**: `src/lib/services/wine/landBuyingService.ts` - Sophisticated vineyard acquisition
- **Properties**: `id`, `name`, `country`, `region`, `hectares`, `grape`, `vineAge`, `soil`, `altitude`, `aspect`, `density`, `vineyardHealth`, `landValue`, `vineyardPrestige`, `ripeness`, `vineYield`
- **Status Types**: `'Barren' | 'Planted' | 'Growing' | 'Harvested' | 'Dormant'`
- **Key Functions**:
  - `purchaseVineyard()`: Buy vineyards with realistic property generation
  - `plantVineyard()`: Plant grape varieties with activity system integration
  - `harvestVineyard()`: Collect grapes with harvest characteristics system
  - `calculateVineyardYield()`: Sophisticated yield calculation with vine age progression
- **UI**: `src/components/pages/Vineyard.tsx` - Complete vineyard management with land buying modal
- **Vine Yield System**: Age-based progression (0.02→1.00→decline) with yearly updates
- **Ripeness System**: Seasonal ripeness progression with aspect/randomness modifiers

**What's NOT Implemented**:
- ❌ **Advanced Properties**:  `vineyardHealth`, `annualYieldFactor`, `annualQualityFactor`
- ❌ **Advanced Farming Methods**: Organic/biodynamic farming not implemented

### 3. Wine Production System ✅ **IMPLEMENTED**
**What's Implemented**:
- **WineBatch Interface**: `src/lib/types/types.ts` - Complete wine batch tracking with characteristics
- **WineBatch Service**: `src/lib/services/wine/wineBatchService.ts` - CRUD operations
- **Winery Service**: `src/lib/services/wine/wineryService.ts` - Production operations
- **Properties**: `id`, `vineyardId`, `vineyardName`, `grape`, `quantity`, `stage`, `process`, `fermentationProgress`, `quality`, `balance`, `characteristics`, `finalPrice`, `harvestDate`, `createdAt`, `completedAt`
- **Dual Tracking System**:
  - **Stage**: `'grapes' | 'must' | 'wine' | 'bottled'` (material state)
  - **Process**: `'none' | 'fermentation' | 'aging' | 'bottled'` (current activity)
- **Key Functions**:
  - `createWineBatchFromHarvest()`: Create from harvest with harvest characteristics system
  - `crushGrapes()`: Convert grapes to must (stage: grapes→must)
  - `startFermentation()`: Begin fermentation (process: none→fermentation)
  - `stopFermentation()`: Complete fermentation (stage: must→wine, process: fermentation→aging)
  - `bottleWine()`: Complete production (stage: wine→bottled, process: aging→bottled)
  - `progressFermentation()`: Manual fermentation progress control
- **UI**: `src/components/pages/Winery.tsx` - Complete winery operations with wine characteristics display

**What's NOT Implemented**:
- ❌ **Storage Locations**: No storage vessel tracking. Fermentation tank, ageing tanks, grape containers ect


### 4. Sales System ✅ **IMPLEMENTED**
**What's Implemented**:
- **Sales Service**: `src/lib/services/sales/salesService.ts` - Complete sales system
- **Customer System**: `src/lib/services/sales/createCustomer.ts` - Regional customer generation
- **Order Generation**: `src/lib/services/sales/generateOrder.ts` - Sophisticated order creation
- **Pricing Service**: `src/lib/services/sales/pricingService.ts` - Multi-factor pricing
- **WineOrder Interface**: `src/lib/types/types.ts` - Order management with customer data
- **Customer Interface**: `src/lib/types/types.ts` - Regional customer characteristics
- **Properties**: `id`, `orderedAt`, `customerType`, `wineBatchId`, `wineName`, `requestedQuantity`, `offeredPrice`, `totalValue`, `status`, `customerId`, `customerName`, `customerCountry`, `customerRelationship`
- **Customer Types**: `'Restaurant' | 'Wine Shop' | 'Private Collector' | 'Chain Store'`
- **Regional System**: 5 countries with country-specific characteristics (purchasing power, wine tradition, market share)
- **Key Functions**:
  - `generateSophisticatedWineOrders()`: Create orders with customer browsing and rejection logic
  - `fulfillWineOrder()`: Execute sales with partial fulfillment support
  - `rejectWineOrder()`: Decline orders with relationship tracking
  - `generateCustomer()`: Prestige-based customer acquisition
  - `calculateWineValueIndex()`: Vineyard value + prestige pricing
  - `calculateWineQualityIndex()`: Quality + balance pricing
- **UI**: `src/components/pages/Sales.tsx` - Complete sales interface with customer information

**What's NOT Implemented**:
- ❌ **Market Mechanics**: No demand/pricing variation over time
- ❌ **Contract System**: No long-term contracts
- ❌ **Market Saturation**: No diminishing returns based on inventory

### 5. Finance System ✅ **IMPLEMENTED**
**What's Implemented**:
- **Finance Service**: `src/lib/services/user/financeService.ts` - Complete transaction management
- **Financial UI**: `src/components/finance/` - Income statements, balance sheets, cash flow
- **Transaction System**: All money flows tracked with audit trail
- **Asset Valuation**: Sophisticated calculation of vineyard (land value), wine (stage×quality×price), and grape values
- **Integration**: Sales and admin tools use transaction system
- **Financial Components**:
  - `IncomeBalanceView.tsx` - Income statements and balance sheets
  - `CashFlowView.tsx` - Cash flow analysis
  - `UpgradesPlaceholder.tsx` - Future upgrades system
- **Transaction Categories**: Income, expenses, sales, purchases, prestige events

**What's NOT Implemented**:
- ❌ **Buildings Value**: Always shows €0 (placeholder)
- ❌ **Advanced Asset Valuation**: No market fluctuations, depreciation, or sophisticated pricing

### 6. Player Interface ✅ **IMPLEMENTED**
**What's Implemented**:
- **Navigation**: `src/components/layout/Header.tsx` - Time display, advance button, player menu, prestige display
- **Player Menu**: Dropdown with Profile, Settings, Admin Dashboard, Achievements, Winepedia, Logout
- **Notification System**: `src/components/layout/NotificationCenter.tsx` - Toast notifications with database persistence NOT ALL SYSTEMS USES THIS YET
- **Admin Dashboard**: `src/components/pages/AdminDashboard.tsx` - Data management tools, prestige management
- **Settings**: `src/components/pages/Settings.tsx` - ONLY BASIC Company-specific settings and preferences
- **Winepedia**: `src/components/pages/Winepedia.tsx` - Grape variety information with interactive tabs
- **Profile**: `src/components/pages/Profile.tsx` - Company management and portfolio stats
- **Achievements**: `src/components/pages/Achievements.tsx` - Achievement system with progress tracking
- **Highscores**: `src/components/pages/Highscores.tsx` - Global leaderboard system
- **Company Overview**: `src/components/pages/CompanyOverview.tsx` - Company stats and navigation
- **Login System**: `src/components/pages/Login.tsx` - Company creation, selection, and highscores
- **Winepedia Tabs**: `DynamicRangeTab`, `CrossTraitPenaltyTab`, `YieldProjectionTab` - Interactive system visualization

**What's NOT Implemented**:
- ❌ **Advanced Profile Features**: Limited profile customization
- ❌ **Achievement Categories**: PLACEHOLDER SYSTEM Basic achievement system only

## 🎯 **Implementation Status Summary**

### ✅ **COMPLETED SYSTEMS**
- **Time Progression**: Manual week advancement with game tick system (order generation, activity progression, vine aging)
- **Vineyard Management**: Land buying, planting, harvesting with sophisticated yield system and vine age progression
- **Wine Production**: Complete grapes → must → wine → bottled pipeline with wine characteristics system
- **Sales System**: Sophisticated customer system, multi-factor pricing, regional characteristics, order rejection logic
- **Finance System**: Transaction tracking, financial reporting, asset valuation with comprehensive UI
- **Player Interface**: Complete navigation, notifications, admin tools, company management, achievement system
- **Wine Characteristics**: 6-characteristic system with balance calculation, cross-trait penalties, synergy rules
- **Activity System**: Planting, harvesting, and other activities with work calculation and progress tracking
- **Prestige System**: Company and vineyard prestige with event tracking and relationship management
- **Company System**: Multi-company support with data isolation and company switching

### ❌ **NOT IMPLEMENTED**
- **Seasonal Effects**: No automatic seasonal changes
- **Advanced Vineyard Properties**: Health,
- **Storage Management**: Detailed vessel tracking
- **Market Mechanics**: Dynamic pricing/demand
- **Contract System**: Long-term sales contracts
- **Advanced Farming Methods**: Organic/biodynamic farming
- **Market Saturation**: Diminishing returns based on inventory

## 🔧 **Technical Architecture**

### Database Schema ✅ **IMPLEMENTED**
- **vineyards**: Vineyard data with company isolation, vine yield, prestige tracking
- **wine_batches**: Wine inventory with stage tracking, characteristics, pricing
- **game_state**: Time, money, and global state with company data
- **wine_orders**: Sales order management with customer relationships
- **transactions**: Financial transaction history with detailed categorization
- **notifications**: Toast notification system with database persistence
- **activities**: Activity system with work tracking and progress
- **prestige_events**: Prestige system with event tracking and decay
- **relationship_boosts**: Customer relationship management

### Component Structure ✅ **IMPLEMENTED**
- **Services**: `src/lib/services/` - Organized by domain (user/, sales/, wine/, core/)
- **UI Components**: `src/components/` - React components with ShadCN, organized by function
- **Hooks**: `src/hooks/` - State management, data loading, and game-specific hooks
- **Utils**: `src/lib/utils/` - Helper functions, calculations, and formatting
- **Types**: `src/lib/types/` - Centralized type definitions with comprehensive interfaces
- **Constants**: `src/lib/constants/` - Game constants, grape data, vineyard data, balance adjustments
- **Database**: `src/lib/database/` - Supabase integration with service layer architecture

---

## 🍷 **Wine Characteristics Balance System**

### Core System ✅ **IMPLEMENTED**
- **6 Characteristics**: acidity, aroma, body, spice, sweetness, tannins (0-1 scale)
- **Per-characteristic ranges**: acidity [0.4,0.6], aroma [0.3,0.7], body [0.4,0.8], spice [0.35,0.65], sweetness [0.4,0.6], tannins [0.35,0.65]
- **Balance formula**: `score = max(0, 1 - 2 × averageDeduction)` where:
  - **Inside Distance**: `|value - midpoint|` (always calculated)
  - **Outside Distance**: distance beyond range bounds (0 if within range)
  - **Penalty**: `2 × Outside Distance`
  - **Total Distance**: `Inside Distance + Penalty`

### Dynamic Range Adjustments ✅ **IMPLEMENTED**
- **Config-driven**: `DYNAMIC_ADJUSTMENTS` with range shifts and penalty multipliers
- **Cross-trait effects**: High acidity shifts sweetness range down, high body shifts spice/tannins up
- **UI**: `DynamicRangeTab` with interactive sliders and live preview

### Cross-Trait System ✅ **IMPLEMENTED**
- **Dynamic range adjustments**: High acidity shifts sweetness range down, high body shifts spice/tannins up
- **Penalty multipliers**: Cross-trait penalty scaling based on characteristic deviations
- **7 synergy rules**: acidity+tannins, body+spice, aroma+body+sweetness combinations
- **Penalty reduction**: Synergies reduce deduction (not add bonus)
- **UI**: `CrossTraitPenaltyTab` with interactive visualization

### Harvest Specific Characteristics ✅ **IMPLEMENTED**
- **Harvest modifiers**: `harvestCharacteristics.ts` applies ripeness, quality, altitude, suitability effects
- **Ripeness**: Late harvest → sweetness↑, acidity↓, tannins↑, body↑, aroma↑
- **Quality**: Influences body, aroma, tannins (color-aware: reds boost tannins more)
- **Altitude**: Higher → acidity↑, aroma↑, body↓
- **Suitability**: Better regions → body↑, aroma↑

### Services & Components ✅ **IMPLEMENTED**
- **Services**: `calculateWineBalance()`, `deriveHarvestCharacteristics()`, `getSynergyReductions()`
- **Hooks**: `useWineBalance()`, `useWineBatchBalance()`, `useFormattedBalance()`, `useBalanceQuality()`
- **UI**: `WineCharacteristicsDisplay`, `CharacteristicBar` with dynamic ranges
- **Winepedia Integration**: `DynamicRangeTab` and `CrossTraitPenaltyTab` with enhanced `CharacteristicBar`
- **Winery Integration**: Updated `Winery.tsx` to use new characteristic display system

### Design Decisions ✅ **IMPLEMENTED**
- **Quality independence**: Quality affects economics/stability, not balance directly
- **Deterministic**: No randomness; grape base + vineyard modifiers = starting characteristics
- **Simple mapping**: Linear `1 - 2 × averageDeduction` (not v1's complex piecewise curve)

---

## 💰 **Advanced Sales System**

### Sophisticated Customer System ✅ **IMPLEMENTED**
- **Regional Customers**: 5 countries with country-specific characteristics (purchasing power, wine tradition)
- **Customer Types**: Private Collector, Restaurant, Wine Shop, Chain Store with different behaviors
- **Market Share Distribution**: Skewed distribution using `calculateSkewedMultiplier` for realistic market shares
- **Customer Names**: Regional name generation with business suffixes per country
- **Relationship Management**: Prestige-based relationships with logarithmic scaling and market share impact

### Advanced Pricing System ✅ **IMPLEMENTED**
- **Wine Value Index**: Combines vineyard land value (logarithmic scaling) + vineyard prestige (60/40 weighted)
- **Quality Index**: Combines wine quality + balance with asymmetrical multiplier scaling
- **Final Price**: `basePrice × qualityMultiplier` with realistic price ranges
- **Price Negotiation**: Customer bid prices with relationship bonuses and regional multipliers

### Dynamic Order Generation ✅ **IMPLEMENTED**
- **Prestige-Based Acquisition**: Linear scaling (0-100 prestige) + logarithmic scaling (100+ prestige) with diminishing returns
- **Order Rejection Logic**: Sophisticated rejection based on price ratios with relationship modifiers
- **Multiple Order System**: Customers browse all wines with diminishing returns per additional order
- **Quantity Calculation**: Price sensitivity + regional factors + relationship bonuses

### Order Management ✅ **IMPLEMENTED**
- **Order Fulfillment**: Partial fulfillment support with inventory management
- **Financial Integration**: Transaction system with detailed sale tracking
- **Prestige Events**: Relationship boosts and vineyard-specific prestige events
- **Notification System**: Real-time feedback for orders and rejections

### Services Architecture ✅ **IMPLEMENTED**
- **Services**: `createCustomer.ts`, `generateCustomer.ts`, `generateOrder.ts`, `pricingService.ts`, `salesOrderService.ts`, `salesService.ts`, `wineQualityIndexCalculationService.ts`, `wineValueIndexCalculationService.ts`
- **Key Features**: Sophisticated pricing, dynamic relationships, regional authenticity, order intelligence, financial integration

### 🔄 **PARTIALLY IMPLEMENTED**
- **Wine Quality System**: Simple average of quality + balance (planned: grape variety characteristics, fermentation effects, aging effects, vintage effects)
- **Contract System**: Not yet implemented (planned: multi-requirement contracts with quality, vintage, balance requirements)

### ❌ **NOT YET IMPLEMENTED**
- **Contract Generation**: Multi-requirement contracts with premium pricing
- **Importer Management**: Advanced importer classes with sophisticated relationship logic
- **Regional Data Integration**: Real-world wine region data for pricing
- **Market Saturation**: Diminishing returns based on available wine inventory


# Known Bugs
