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

### 4. Sales System (NOT YET IMPLEMENTET)
- Wine order generation
- Dynamic pricing engine
- Contract system for stable income
- Customer preferences and archetypes
- Price negotiation mechanics

### 5. Game Flow
- End-day/tick system for game progression
- Tutorial system with guided learning (NOT YET IMPLEMENTET)
- Notification system for game events (NOT YET IMPLEMENTET)
- Work calculation system for tasks (NOT YET IMPLEMENTET)
- Building maintenance cycle (NOT YET IMPLEMENTET)
