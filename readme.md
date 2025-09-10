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
- **`useAsyncData<T>()`**: Reusable hook for loading async data with automatic updates via global subscription system

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

### 🏗️ Database Architecture (v0.5)
**Separate Tables for Scalability:**
- **`vineyards`**: Individual vineyard records with proper indexing
- **`wine_batches`**: Wine production pipeline with stage/process tracking
- **`game_state`**: Time/season and financial data only
- **Performance**: Indexed queries, partial updates, no JSON blob storage

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
- **Vineyard Creation**: Create vineyards with name, country, region, acres
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
- **Wine Order Generation**: Random order generation with weighted customer types
- **Sophisticated Pricing Engine**: Base Price = (Land Value + Prestige) × Base Rate, Final Price = Base Price × Quality Multiplier
- **Mathematical Quality Scaling**: Multi-segment scaling with polynomial, logarithmic, linear, and exponential curves
- **Order Management**: Accept/Reject orders with inventory validation and money transactions
- **Customer Types**: Local Restaurant, Wine Shop, Private Collector, Export Order with different pricing
- **Wine Case Sizes**: Proper European 6-bottle cases with realistic quantity ranges
- **Quality Display**: Color-coded quality/balance indicators in sales interface

**Future Advanced Features (NOT YET IMPLEMENTED):**
- Contract system for stable income
- Customer preferences and archetypes
- Price negotiation mechanics
- Sophisticated pricing based on land value, field prestige, vintage aging

### 5. Finance System ✅ **IMPLEMENTED**
- **Transaction Management**: Complete financial transaction system with Supabase integration
- **Financial Reporting**: Income statements, balance sheets, and cash flow statements with period filtering
- **Asset Valuation**: Automatic calculation of vineyard, wine inventory, and grape values
- **Transaction History**: Complete audit trail of all financial activities with categorization
- **Integration**: All money flows (sales, admin tools) go through transaction system
- **UI Components**: Tabbed finance interface with Income/Balance, Cash Flow, and Research/Upgrades sections

### 6. Player Interface & Navigation ✅ **IMPLEMENTED** But mostly with placeholders**
- **Player Menu System**: Dropdown navigation accessible via player avatar in header
- **Notification Center**: In-app message history with filtering, timestamps, and real-time updates
- **Toast Notifications**: Global notification system for game events and user feedback
- **Admin Dashboard**: Data management tools for clearing localStorage and Supabase database, financial management
- **Settings Management**: Game preferences and notification visibility controls
- **Page Routing**: Complete navigation between Dashboard, Vineyard, Winery, Sales, Finance, and player menu pages

### 7. Game Flow
- End-day/tick system for game progression
- Tutorial system with guided learning (NOT YET IMPLEMENTET)
- Work calculation system for tasks (NOT YET IMPLEMENTET)
- Building maintenance cycle (NOT YET IMPLEMENTET)
