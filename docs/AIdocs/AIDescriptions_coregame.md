# Core Game Mechanics - Winery Management Game

## 🎯 Current Implementation Status

This document describes what has been **actually implemented** in the Winery Management Game as of 2026-05-21.

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
- **Vineyard Interface**: Complete vineyard interface with health system, overgrowth tracking, and clearing activities
- **Land Buying System**: `src/lib/services/vineyard/landSearchService.ts` - Sophisticated land search and acquisition
- **Health System**: Vineyard health tracking with interactive tooltips and health-aware activities
- **Clearing System**: `src/lib/services/vineyard/clearingService.ts` - Clearing/uprooting activities with health impact
- **Overgrowth System**: Task-specific overgrowth tracking (vegetation, debris, uproot, replant)
- **Key Functions**:
  - `purchaseVineyard()`: Buy vineyards with realistic property generation
  - `plantVineyard()`: Plant grape varieties with activity system integration
  - `harvestVineyard()`: Collect grapes with harvest characteristics system
  - `calculateVineyardYield()`: Sophisticated yield calculation with vine age progression
- **UI**: `src/components/pages/Vineyard.tsx` - Complete vineyard management with health display
- **Vine Yield System**: Age-based progression (0.02→1.00→decline) with yearly updates
- **Ripeness System**: Seasonal ripeness progression with aspect/randomness modifiers
** VineyardModal.ts for detailed UI for users 

### 3. Wine Production System ✅ **IMPLEMENTED**
**What's Implemented**:
- **WineBatch Interface**: Complete wine batch tracking with characteristics and wine features
- **Wine Features Framework**: Config-driven wine features (oxidation, terroir, stuck fermentation, bottle aging, late harvest)
- **Winery Service**: Production operations with feature risk tracking
- **Structure and Taste**: `structureIndex` scores the six structural channels; `tasteQualityIndex` scores the 14 flavor-family taste profile.
- **Wine Score**: Current implementation uses `(tasteQualityIndex + structureIndex) / 2`.
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
- **UI**: `src/components/pages/Winery.tsx` - Complete winery operations with wine features display
**What's NOT Implemented**:
- ❌ **Storage Locations**: No storage vessel tracking. Fermentation tank, ageing tanks, grape containers ect

### 4. Sales System ✅ **IMPLEMENTED**
**What's Implemented**:
- **Sales Service**: `src/lib/services/sales/salesService.ts` - Complete sales system
- **Customer System**: `src/lib/services/sales/createCustomer.ts` - Regional customer generation
- **Order Generation**: `src/lib/services/sales/generateOrder.ts` - Sophisticated order creation
- **Pricing Logic**: `src/lib/services/wine/winescore/wineScoreCalculation.ts` and sales services provide multi-factor pricing
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
  - `calculateEstimatedPriceBreakdown()`: WineScore, land value, feature, and prestige pricing breakdown
- **UI**: `src/components/pages/Sales.tsx` - Complete sales interface with customer information

**What's NOT Implemented**:
- ❌ **Market Mechanics**: No demand/pricing variation over time
- ❌ **Market Saturation**: No diminishing returns based on inventory

**What's Implemented For Contracts**:
- ✅ **Contract System**: Multi-year contracts with taste, structure, site, grape, vintage, and characteristic requirements
- ✅ **Taste/Site Split**: `tasteQuality` validates computed taste quality; `landValue`, `country`, `region`, `altitude`, and `aspect` validate site requirements.

### 5. Finance System ✅ **IMPLEMENTED**
**What's Implemented**:
- **Finance Service**: `src/lib/services/user/financeService.ts` - Complete transaction management
- **Financial UI**: `src/components/finance/` - Income statements, balance sheets, cash flow
- **Transaction System**: All money flows tracked with audit trail
- **Asset Valuation**: Calculation of vineyard value, wine inventory value from estimated price, and grape values
- **Integration**: Sales and admin tools use transaction system
- **Financial Components**:
  - `IncomeBalanceView.tsx` - Income statements and balance sheets
  - `CashFlowView.tsx` - Cash flow analysis
  - `UpgradesPlaceholder.tsx` - Future upgrades system
- **Transaction Categories**: Income, expenses, sales, purchases, prestige events

**What's NOT Implemented**:
- ❌ **Buildings Value**: Always shows €0 (placeholder)
- ❌ **Advanced Asset Valuation**: No market fluctuations, depreciation, or sophisticated pricing
 - Loan, economy phase

### 6. Player Interface ✅ **IMPLEMENTED**
**What's Implemented**:
- **Navigation**: `src/components/layout/Header.tsx` - Time display, advance button, player menu, prestige display, and top-level gameplay tabs including Research
- **Player Menu**: Dropdown with Profile, Settings, Achievements, Winepedia, Logout, and a development-only Admin Dashboard entry on localhost/loopback hosts
- **Notification System**: `src/lib/services/core/notificationService.ts` - Centralized notification system with database persistence
- **Admin Dashboard**: `src/components/pages/AdminDashboard.tsx` - Development-only admin tools, prestige/data controls, and the `Test Systems` tab
- **Settings**: `src/components/pages/Settings.tsx` - Company-specific settings and notification preferences
- **Winepedia**: `src/components/pages/Winepedia.tsx` - Grape variety information with interactive tabs
- **Profile**: `src/components/pages/Profile.tsx` - Company management and portfolio stats
- **Achievements**: `src/components/pages/Achievements.tsx` - Dynamic tier-based achievement system
- **Highscores**: `src/components/pages/Highscores.tsx` - Global leaderboard system
- **Company Overview**: `src/components/pages/CompanyOverview.tsx` - Company stats and navigation
- **Login System**: `src/components/pages/Login.tsx` - Company creation, selection, and highscores
- **Staff System**: `src/components/pages/Staff.tsx` - Staff management with teams, search, and recruitment
- **Winepedia Tabs**: `DynamicRangeTab`, `CrossTraitPenaltyTab`, `YieldProjectionTab` - Interactive system visualization
- **Automated Tests**: `tests/` - Source-of-truth Vitest suite for service and gameplay regression coverage
- **Admin Test Systems**: `src/components/pages/admin/TestLabPage.tsx` plus `src/lib/services/admin/testLab/` - Dev-only surface that separates the shared automated test suite from the separate Gameflow Lab used to create inspectable game states without waiting for natural ticks

### 7. Research System ✅ **IMPLEMENTED (Core + UI)**
**What's Implemented**:
- **Research Catalog + Progression**: Project definitions with complexity, prerequisites, prestige requirements, and category-specific pacing profiles in `src/lib/constants/researchConstants.ts`
- **Activity Integration**: Research projects start as activities with shared work calculation and upfront cost in `src/lib/services/activity/workcalculators/researchWorkCalculator.ts`
- **Eligibility Enforcement**: Start flow checks requirements (prestige, prerequisites, company value, buyer loyalty, achievements) via `src/lib/services/research/researchEligibilityService.ts`
- **Unlock Persistence**: Completed research is persisted company-scoped through `src/lib/database/core/researchUnlocksDB.ts`
- **UI**: Dedicated research page (`src/components/pages/Research.tsx`) and panel (`src/components/finance/ResearchPanel.tsx`) with completed, in-progress, locked, and available states
- **Active Bonuses UI**: Research page now surfaces permanent bonuses from completed research in a visible summary panel
- **Implemented Gates**:
  - `grape` unlocks in planting
  - `fermentation_technology` unlocks in fermentation options modal
  - `contract_type` unlocks in contract generation
  - `staff_limit` and `vineyard_size` tier caps in hiring and land search
- **Permanent Effect Minimum Slice**: Runtime permanent-effect aggregation for completed research, applied to vineyard health degradation (`vineyard_health_decay_multiplier`)

**What's NOT Implemented Yet**:
- ❌ **Equipment Unlock Track**: No standalone equipment gameplay system exists yet
- ❌ **Vineyard Technique Track**: Still planned as dedicated projects with explicit domain hooks

## 🎯 **Implementation Status Summary**

### ✅ **COMPLETED SYSTEMS**
- **Time Progression**: Manual week advancement with game tick system (order generation, activity progression, vine aging)
- **Vineyard Management**: Land buying, planting, harvesting with health system, overgrowth tracking, and clearing activities
- **Wine Production**: Complete grapes → must → wine → bottled pipeline with wine features framework
- **Sales System**: Sophisticated customer system, multi-factor pricing, regional characteristics, order rejection logic
- **Finance System**: Transaction tracking, financial reporting, asset valuation with comprehensive UI
- **Player Interface**: Complete navigation, notifications, admin tools, company management, achievement system
- **Staff System**: Staff management with teams, search, recruitment, and wage calculation
- **Wine Characteristics**: 6-characteristic system with structure index calculation, cross-trait penalties, synergy rules
- **Taste System**: 14 flavor families, descriptor display values, family-level Taste Quality score, and Taste UI breakdown
- **Wine Features**: Config-driven wine features (oxidation, terroir, stuck fermentation, bottle aging, late harvest)
- **Activity System**: Planting, harvesting, clearing, and other activities with work calculation and progress tracking
- **Prestige System**: Company and vineyard prestige with event tracking and relationship management
- **Company System**: Multi-company support with data isolation and company switching

### ❌ **NOT IMPLEMENTED**
- **Seasonal Effects**: No automatic seasonal changes
- **Storage Management**: Detailed vessel tracking
- **Market Mechanics**: Dynamic pricing/demand
- **Advanced Farming Methods**: Organic/biodynamic farming
- **Market Saturation**: Diminishing returns based on inventory
- **Customer Taste Preferences**: Deferred until they can cover both structure and taste

## 🔧 **Technical Architecture**

### Database Schema ✅ **IMPLEMENTED**
- **vineyards**: Vineyard data with company isolation, health tracking, overgrowth system
- **wine_batches**: Wine inventory with stage tracking, characteristics, wine features
- **game_state**: Time, money, and global state with company data
- **wine_orders**: Sales order management with customer relationships
- **transactions**: Financial transaction history with detailed categorization
- **notifications**: Centralized notification system with database persistence
- **activities**: Activity system with work tracking and progress
- **staff**: Staff management with teams, skills, and wage calculation
- **achievements**: Dynamic tier-based achievement system
- **prestige_events**: Prestige system with event tracking and decay
- **relationship_boosts**: Customer relationship management

### Component Structure ✅ **IMPLEMENTED**
- **Services**: `src/lib/services/` - Organized by domain (user/, sales/, wine/, core/, activity/, vineyard/)
- **UI Components**: `src/components/` - React components with ShadCN, organized by function
- **Hooks**: `src/hooks/` - State management, data loading, and game-specific hooks
- **Utils**: `src/lib/utils/` - Helper functions, calculations, and formatting
- **Types**: `src/lib/types/` - Centralized type definitions with comprehensive interfaces
- **Constants**: `src/lib/constants/` - Game constants, grape data, vineyard data, wine features
- **Database**: `src/lib/database/` - Supabase integration with service layer architecture
