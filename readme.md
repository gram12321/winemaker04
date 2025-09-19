# Winery Management Game – AI Development Guide

**AI Agent Context**: Turn-based winery simulation with formula-based economics, no multiplayer.

## 🔧 Core Architecture
- **Framework**: React + TypeScript + Supabase
- **Styling**: Tailwind CSS + ShadCN UI (no custom CSS)
- **Economics**: Formula-based calculations, not dynamic simulation
- **Data Flow**: Services → Database → Global Updates → Reactive UI

### 🧠 Development Patterns

**CRITICAL RULES FOR AI AGENTS:**
- **ALWAYS use barrel exports**: `@/components/ui`, `@/hooks`, `@/lib/services`, `@/lib/utils`
- **ALWAYS use custom hooks**: `useLoadingState()`, `useGameStateWithData()`, `useGameState()`
- **ALWAYS use shared interfaces**: `PageProps`, `NavigationProps`, `CompanyProps` from `@/components/UItypes`
- **Business logic in services**: Never put calculations in components
- **Reactive updates**: Services trigger global updates, components auto-refresh

**Key Hooks:**
- `useGameStateWithData<T>()` - Async data with auto-updates
- `useLoadingState()` - Loading wrapper for async operations  
- `usePrestigeUpdates()` - Event-driven prestige monitoring
- `useTableSortWithAccessors()` - Type-safe table sorting

**MCP Integration:**
- Supabase MCP configured in `.cursor/mcp.json`
- Both anon and service role keys available
- PAT required for database management

### 🏗️ Database Schema
**Core Tables:**
- `companies` - Financial data, prestige, game state
- `vineyards` - Company_id, vine age, soil, altitude, aspect, prestige  
- `wine_batches` - Production pipeline with characteristics
- `wine_orders` - Customer orders with relationship tracking
- `customers` - Global database with regional characteristics
- `prestige_events` - Comprehensive prestige tracking with decay
- `relationship_boosts` - Customer relationship events
- `transactions` - Financial history with categorization

**Data Flow**: Services → Database → Global Updates → Reactive UI

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
- **Environmental Factors**: Soil composition, altitude, aspect, and land value tracking
- **Vine Aging**: Annual vine aging system for realistic vineyard progression
- **Vineyard Prestige**: Sophisticated prestige calculation based on environmental factors
- **Database Integration**: Full CRUD operations with reactive UI updates

**Future Advanced Features (NOT YET IMPLEMENTED):**
- Dynamic health system (0-1 scale)
- Field clearing and preparation
- Harvest timing and ripeness tracking

### 3. Staff System (NOT YET IMPLEMENTET)
- Skill-based hiring with specializations
- Work rate calculations based on skills
- Staff search and recruitment system
- Wage calculation and payment system
- Team management and task assignment

### 4. Sales System ✅ **IMPLEMENTED**
- **Customer System**: Global database with regional characteristics (purchasing power, wine tradition, market share)
- **Order Generation**: Prestige-based customer acquisition with sophisticated scaling
- **Multi-Factor Pricing**: Customer-specific pricing based on characteristics and relationships
- **Order Management**: Accept/Reject with inventory validation and relationship tracking
- **Customer Types**: Restaurant, Wine Shop, Private Collector, Chain Store
- **Performance**: Active customer optimization for relationship updates
**Future Advanced Features (NOT YET IMPLEMENTED):**
- Contract system for stable income
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
- **Winepedia System**: Interactive wine knowledge base with grape varieties and relationships
- **Page Routing**: Company Overview, Vineyard, Winery, Sales, Finance navigation

---

## 📋 **Implementation Status**

✅ **COMPLETED SYSTEMS:**
- Multi-company database with prestige system
- React + TypeScript + Tailwind + ShadCN with barrel exports
- Authentication with company management
- Centralized game state with reactive updates
- Vineyard management with environmental factors
- Wine production pipeline
- Sales system with customer relationships
- Finance system with transaction tracking
- Player interface with Winepedia

❌ **NOT IMPLEMENTED:**
- Staff management system
- Wine characteristics and quality tracking
- Contract system for stable income
- Building upgrades and maintenance
- Advanced customer preferences
