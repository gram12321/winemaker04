# Winery Management Game – Architecture & Code Generation Guide

This briefing is for AI-assisted code generation for the **Winery Management Game**, a turn-based single-player simulation game.

---

## 🔧 Project Overview
Players manage a winery, including vineyard operations, wine production, building upgrades, staff, and sales. The game includes a simple economic engine with **formula-based wine prices** and **NPC buyers** — there is **no multiplayer or player-to-player interaction**.

### 💻 Frontend Architecture

- **Framework**: React + TypeScript + supabase
- **Styling**: Tailwind CSS, SHADCN (Maybe bootstrap if nessesacy) (no custom CSS in this iteration).


### 🧠 State & Logic

- **Game State**: Time/season and financial data centralized in `gameState.ts`
- **Database**: Vineyards and inventory stored in separate Supabase tables for scalability
- **Game Logic**: All business logic (production, quality calculations, finances) in service files, not components

#### React Hooks for State Management
- **`useGameInit()`**: Initializes game state on app startup, handles loading/error states
- **`useGameUpdates()`**: Global subscription system for reactive UI updates across components
- **`useGameStateWithData<T>()`**: Enhanced hook for loading async data with automatic updates via global subscription system (replaces useAsyncData)
- **`usePrestigeUpdates()`**: Event-driven hook that monitors prestige changes and updates customer relationships for active customers only
- **`useLoadingState()`**: Simplified loading state hook with withLoading wrapper for async operations
- **`useTableSortWithAccessors()`**: Hook for table sorting functionality with type-safe accessors

#### Barrel Export/Import System
- **Centralized Imports**: All components, hooks, services, and utilities use barrel exports for cleaner imports
- **`@/components/ui`**: Single import for all ShadCN UI components
- **`@/hooks`**: Single import for all custom hooks
- **`@/lib/services`**: Single import for all service functions
- **`@/lib/utils`**: Single import for all utility functions
- **Shared Interfaces**: `@/components/UItypes` provides consistent prop types across components

### 🔌 Supabase Backend (MCP Server Tools)

- **MCP Configuration**: Supabase MCP server configured in `.cursor/mcp.json`
- **Access Levels**: Both anon and service role keys available for different operations
- **Management API**: Personal Access Token (PAT) required for database management operations
- **Environment**: All Supabase credentials managed through MCP server configuration

### 📈 Economic System
- The economy is **formula-based**, not dynamic or real-time.
- Wine prices, land values, and prestige scores are **calculated**, not simulated.
- Sales are resolved to randomized NPCs (non-interactive).
- **Mathematical Functions**: Centralized in `src/lib/utils/calculator.ts` with sophisticated multi-segment scaling algorithms

### 🏗️ Database Architecture (v0.6)
**Multi-Company Database Design:**
- **`companies`**: Company records with financial data, prestige, and game state
- **`users`**: User profiles with authentication and preferences
- **`vineyards`**: Individual vineyard records with company_id for data isolation
- **`wine_batches`**: Wine production pipeline with stage/process tracking
- **`wine_orders`**: Customer orders with relationship tracking and calculation data
- **`customers`**: Global customer database with regional characteristics and relationship management
- **`company_customers`**: Junction table for active customer tracking and performance optimization
- **`relationship_boosts`**: Customer relationship boost events with decay tracking
- **`transactions`**: Financial transaction history with categorization
- **`highscores`**: Global leaderboard system with company value rankings
- **`achievements`**: Achievement system with progress tracking
- **Performance**: Indexed queries, company-specific data isolation, optimized customer loading

**Reactive State Pattern:**
- Services update database → trigger global updates → components auto-refresh
- No manual refresh needed, fully reactive UI
- Optimistic updates with error handling

## Core Game Systems & Features

### 1. Wine Production System ✅ **IMPLEMENTED**
- **Wine Batch Pipeline**: grapes → must → wine → bottled
- **Process Tracking**: none → fermentation → aging → bottled
- **Winery Actions**: Crushing, Start/Stop Fermentation, Progress Tracking, Bottling
- **Fermentation Progress**: 0-100% with manual progress control
- **Completed Wine Format**: "Grape Variety, Vineyard Name, Vintage" with bottle count
- **Database Integration**: Full CRUD operations with reactive UI updates

**Future Advanced Features (NOT YET IMPLEMENTED):**
- Wine characteristics (Sweetness, Acidity, Tannins, Body, Spice, Aroma)
- Quality tracking through production stages
- Balance calculation system with archetypes
- Processing influence on characteristics (crushing methods, fermentation)
- Wine archetypes for style matching

### 2. Vineyard Management ✅ **IMPLEMENTED**
- **Vineyard Creation**: Create vineyards with name, country, region, hectares
- **Planting System**: Plant grape varieties (Chardonnay, Pinot Noir, Cabernet Sauvignon, Merlot)
- **Status Management**: Barren → Planted → Growing → Harvested → Dormant cycle
- **Harvest System**: Collect grapes and automatically create wine batches
- **Database Integration**: Full CRUD operations with reactive UI updates

**Future Advanced Features (NOT YET IMPLEMENTED):**
- Dynamic health system (0-1 scale)
- Field clearing and preparation
- Environmental factors (soil, altitude, aspect)
- Harvest timing and ripeness tracking

### 3. Staff System (NOT YET IMPLEMENTET)
- Skill-based hiring with specializations
- Work rate calculations based on skills
- Staff search and recruitment system
- Wage calculation and payment system
- Team management and task assignment

### 4. Sales System ✅ **IMPLEMENTED**
- **Sophisticated Customer System**: Global customer database with regional characteristics (purchasing power, wine tradition, market share)
- **Dynamic Order Generation**: Company prestige-based customer acquisition with sophisticated scaling and diminishing returns
- **Multi-Factor Pricing**: Customer-specific pricing based on regional characteristics, market share, and relationship strength
- **Customer Relationship Management**: Hybrid system with active customer tracking and relationship boost events
- **Order Management**: Accept/Reject orders with inventory validation, relationship tracking, and detailed calculation data
- **Customer Types**: Restaurant, Wine Shop, Private Collector, Chain Store with realistic quantity ranges and pricing
- **Relationship Display**: Color-coded relationship indicators with detailed breakdown tooltips
- **Performance Optimization**: Only updates relationships for active customers (those who have placed orders)

**Future Advanced Features (NOT YET IMPLEMENTED):**
- Contract system for stable income
- Customer preferences and archetypes
- Price negotiation mechanics
- Advanced relationship events and customer loyalty programs

### 5. Customer Relationship System ✅ **IMPLEMENTED**
- **Global Customer Database**: 300+ customers across multiple countries with realistic regional characteristics
- **Relationship Calculation**: Sophisticated formula combining company prestige, customer market share, and relationship boosts
- **Active Customer Optimization**: Only tracks and updates relationships for customers who have placed orders
- **Relationship Boosts**: Sales create relationship boost events that decay over time
- **Hybrid Data Management**: Combines stored relationship values for display with fresh calculations for game logic
- **Performance Monitoring**: Automatic prestige change detection with selective relationship updates
- **UI Integration**: Detailed relationship breakdowns in tooltips with formula explanations and discrepancy notes

### 6. Finance System ✅ **IMPLEMENTED**
- **Transaction Management**: Complete financial transaction system with Supabase integration
- **Financial Reporting**: Income statements, balance sheets, and cash flow statements with period filtering
- **Asset Valuation**: Automatic calculation of vineyard, wine inventory, and grape values
- **Transaction History**: Complete audit trail of all financial activities with categorization
- **Integration**: All money flows (sales, admin tools) go through transaction system
- **UI Components**: Tabbed finance interface with Income/Balance, Cash Flow, and Research/Upgrades sections

### 7. Player Interface & Navigation ✅ **IMPLEMENTED**
- **Login System**: Company selection, creation, and user profile management with authentication
- **Company Management**: Multi-company support with switching, portfolio stats, and company-specific data
- **Player Menu System**: Dropdown navigation accessible via player avatar in header
- **Notification Center**: In-app message history with filtering, timestamps, and real-time updates
- **Toast Notifications**: Global notification system for game events and user feedback
- **Admin Dashboard**: Comprehensive database management, cheat tools, and system administration
- **Settings Management**: Company-specific game preferences and notification visibility controls
- **Global Leaderboards**: Company value rankings and competitive features
- **Achievement System**: Progress tracking, unlockable rewards, and milestone recognition
- **Page Routing**: Complete navigation between Company Overview, Vineyard, Winery, Sales, Finance, and player menu pages

### 8. Game Flow
- End-day/tick system for game progression
- Tutorial system with guided learning (NOT YET IMPLEMENTET)
- Work calculation system for tasks (NOT YET IMPLEMENTET)
- Building maintenance cycle (NOT YET IMPLEMENTET)

---

## 📋 **Current Status Summary**

- **Database**: ✅ Multi-company Supabase integration with data isolation
- **Frontend**: ✅ Complete React + TypeScript + Tailwind + ShadCN setup
- **Authentication**: ✅ User login system with company management
- **Game State**: ✅ Centralized management with time progression
- **UI/UX**: ✅ Modern login system, company switching, and comprehensive navigation
- **Competitive Features**: ✅ Global leaderboards and achievement system
- **Development**: ✅ Production-ready codebase with clean architecture

### 🔮 **Next Steps**
- Advanced vineyard management (health system, environmental factors)
- Enhanced wine production (characteristics, quality tracking, aging)
- Contract system for stable income
- Staff management and hiring system
- Building upgrades and maintenance
- Advanced customer preferences and loyalty programs
