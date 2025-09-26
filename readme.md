# Winery Management Game – AI Development Guide

**AI Agent Context**: Turn-based winery simulation with formula-based economics, no multiplayer.

## 🔧 Core Architecture
- **Framework**: React + TypeScript + Supabase
- **Styling**: Tailwind CSS + ShadCN UI (no custom CSS)
- **Data Flow**: Services → Database → Global Updates → Reactive UI

### 🧠 Development Patterns

**CRITICAL RULES FOR AI AGENTS:**
- **ALWAYS use barrel exports**: `@/components/ui`, `@/hooks`, `@/lib/services`, `@/lib/utils`, `@/lib/constants`
- **ALWAYS use custom hooks**: `useLoadingState()`, `useGameStateWithData()`, `useGameState()`, `useGameUpdates()`, `usePrestigeUpdates()`, `useWineBalance()`, `useWineBatchBalance()`, `useFormattedBalance()`, `useBalanceQuality()`, `useTableSortWithAccessors()`
- **ALWAYS use shared interfaces**: `PageProps`, `NavigationProps`, `CompanyProps`, `DialogProps`, `FormProps`, `TableProps`, `LoadingProps`, `CardProps`, `BaseComponentProps` from `@/components/UItypes`
- **ALWAYS use service exports**: Game state (`getGameState`, `updateGameState`, `getCurrentCompany`, `getCurrentPrestige`), Finance (`addTransaction`, `loadTransactions`, `calculateFinancialData`), Sales (`fulfillWineOrder`, `rejectWineOrder`, `generateSophisticatedWineOrders`), Vineyard (`createVineyard`, `plantVineyard`, `getAllVineyards`, `purchaseVineyard`), Winery (`crushGrapes`, `startFermentation`, `stopFermentation`, `bottleWine`, `progressFermentation`)
- **ALWAYS use utility exports**: Formatting (`formatNumber`, `formatCurrency`, `formatDate`, `formatGameDate`, `formatPercent`), Calculations (`calculateSkewedMultiplier`, `calculateAsymmetricalMultiplier`, `calculateBaseWinePrice`), Company utils (`getCurrentCompanyId`, `getCompanyQuery`), Wine utilities (`getWineQualityCategory`, `getColorClass`, `getBadgeColorClasses`)
- **Business logic in services**: Never put calculations in components
- **Reactive updates**: Services trigger global updates, components auto-refresh

**⚠️ Mobile Responsiveness:** The codebase includes `useIsMobile()` hook for responsive design. Future components should consider mobile layouts and test across different screen sizes.

**Constants Directory (`@/lib/constants`):** Centralized configuration and data via barrel exports:
- Import from `@/lib/constants` (barrel). It re-exports:
  - `constants.ts` - Game initialization, sales constants, wine quality, customer regional data
  - `vineyardConstants.ts` - Country-region mapping, soil types, altitude ranges, market data
  - `grapeConstants.ts` - Grape metadata and base wine characteristics
  - `namesConstants.ts` - Country-specific name databases for vineyards and customers
  - `activityConstants.ts` - Activity system constants and work calculations
  - `balanceAdjustments.ts` - Wine balance system configuration (dynamic adjustments, synergy rules)

**MCP Integration:**
- Supabase MCP configured in `.cursor/mcp.json`
- Both anon and service role keys available
- PAT required for database management

**Legacy Reference Documentation:**
- `@docs/old_iterations/v1/` - Original JavaScript implementation with complex balance system
- `@docs/old_iterations/v3/` - Previous React/TypeScript iteration with different architecture
- Use for reference when implementing new features or understanding legacy systems

**Local Storage Policy:**
- Only `lastCompanyId` is persisted for autologin. No full company object is stored. All live data (prestige, money, etc.) is fetched from DB/services and updated via hooks.

### 🏗️ Database Schema
**Core Tables:**
- `companies` - Company data, financial state, prestige, game progression
- `users` - User accounts and authentication
- `vineyards` - Vineyard management (vine age, soil, altitude, aspect, prestige)
- `wine_batches` - Wine production pipeline (grapes → must → wine → bottled)
- `wine_orders` - Customer orders with relationship tracking and pricing
- `wine_log` - Wine production history and completed wines
- `customers` - Global customer database with regional characteristics
- `company_customers` - Company-customer relationship tracking
- `prestige_events` - Comprehensive prestige tracking with decay
- `relationship_boosts` - Customer relationship events and boosts
- `transactions` - Financial history with categorization
- `activities` - Activity system (planting, harvesting, etc.)
- `notifications` - System notifications and alerts
- `highscores` - Leaderboard and achievement tracking
- `achievements` - Achievement system
- `user_settings` - User preferences and configuration

**Data Flow**: Services → Database → Global Updates → Reactive UI

## Core Game Systems & Features

### 1. Wine Production System ✅ **IMPLEMENTED**
- **Wine Batch Pipeline**: grapes → must → wine → bottled
- **Process Tracking**: none → fermentation → aging → bottled
- **Winery Actions**: Crushing, Start/Stop Fermentation, Progress Tracking, Bottling
- **Fermentation Progress**: 0-100% with manual progress control
- **Completed Wine Format**: "Grape Variety, Vineyard Name, Vintage" with bottle count
- **Database Integration**: Full CRUD operations with reactive UI updates

**Implemented (Advanced System):**
- Wine characteristics (acidity, aroma, body, spice, sweetness, tannins) with per-characteristic balanced ranges
- Sophisticated balance calculation with cross-trait penalties and synergy rules
- Harvest characteristics system with vineyard condition modifiers (ripeness, quality, altitude, suitability)
- Dynamic range adjustments and penalty multipliers with interactive UI visualization
- Grape-specific base characteristics with harvest-specific modifications

**Future Advanced Features:**
- Quality tracking through production stages
- Processing influence on characteristics (crushing methods, fermentation)
- Wine archetypes for style matching

### 2. Vineyard Management ✅ **IMPLEMENTED**
- **Vineyard Creation**: Create vineyards with name, country, region, hectares
- **Planting System**: Plant grape varieties (Chardonnay, Pinot Noir, Cabernet Sauvignon, Merlot)
- **Status Management**: Barren → Planted → Growing → Harvested → Dormant cycle
- **Harvest System**: Collect grapes and automatically create wine batches
- **Environmental Factors**: Soil composition, altitude, aspect, and land value tracking
- **Vine Aging**: Annual vine aging system for realistic vineyard progression
- **Vineyard Prestige**: Sophisticated prestige calculation based on environmental factors
- **Database Integration**: Full CRUD operations with reactive UI updates

**Advanced Features:**
- Land buying system with realistic property generation and affordability checking
- Vine yield system with age-based progression (0.02→1.00→decline)
- Ripeness progression by season with aspect and seasonal randomness modifiers
- Activity system with work calculation for planting and harvesting

**Future Advanced Features (NOT YET IMPLEMENTED):**
- Dynamic health system (0-1 scale)
- Field clearing and preparation

### 3. Staff System (NOT YET IMPLEMENTET)
- Skill-based hiring with specializations
- Work rate calculations based on skills
- Staff search and recruitment system
- Wage calculation and payment system
- Team management and task assignment

### 4. Sales System ✅ **IMPLEMENTED**
- **Customer System**: Regional customers (5 countries) with country-specific characteristics
- **Order Generation**: Prestige-based acquisition with sophisticated rejection logic
- **Multi-Factor Pricing**: Wine value index + quality index with realistic scaling
- **Order Management**: Partial fulfillment support with relationship tracking
- **Customer Types**: Restaurant, Wine Shop, Private Collector, Chain Store
- **Advanced Features**: Customer browsing, diminishing returns, calculation data persistence
**Future Advanced Features (NOT YET IMPLEMENTED):**
- Contract system for stable income
- Market saturation mechanics
- Advanced importer management
- Customer preferences and archetypes
- Price negotiation mechanics
- Advanced relationship events and customer loyalty programs


### 5. Customer Relationship System ✅ **IMPLEMENTED**
- 300+ global customers with regional traits
- Relationships calculated from prestige, market share, and sales boosts
- Only active (ordering) customers are tracked
- Sales boost relationships, which decay over time
- Stored values for display, live calculations for logic
- UI: Tooltip breakdowns and Winepedia integration

### 5. Finance System ✅ **IMPLEMENTED**
- **Transaction Management**: Complete financial system with Supabase integration
- **Financial Reporting**: Income statements, balance sheets, cash flow statements
- **Asset Valuation**: Automatic calculation of vineyard, wine inventory, grape values
- **Integration**: All money flows through transaction system

### 6. Player Interface ✅ **IMPLEMENTED**
- **Login System**: Company selection, creation, user profile management
- **Company Management**: Multi-company support with switching and portfolio stats
- **Player Menu**: Dropdown navigation, notification center, admin dashboard
- **Winepedia System**: Interactive wine knowledge base with grape varieties, balance system visualization
- **Page Routing**: Company Overview, Vineyard, Winery, Sales, Finance navigation
- **Achievement System**: Progress tracking with filtering and categorization
- **Highscores**: Global leaderboard system with company value rankings

---

## 📋 **Implementation Status**

✅ **COMPLETED SYSTEMS:**
- Multi-company database with prestige system and relationship management
- React + TypeScript + Tailwind + ShadCN with barrel exports
- Authentication with company management and highscores
- Centralized game state with reactive updates and game tick system
- Advanced vineyard management with land buying, vine yield, and activity system
- Sophisticated wine production with characteristics and balance system
- Advanced sales system with regional customers and multi-factor pricing
- Finance system with transaction tracking and asset valuation
- Complete player interface with Winepedia, achievements, and admin tools

❌ **NOT IMPLEMENTED:**
- Staff management system
- Contract system for stable income
- Storage vessel tracking (fermentation tanks, aging tanks)
- Seasonal effects on vineyards/wine
- Advanced farming methods (organic/biodynamic)
