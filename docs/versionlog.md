## Version 0.0023 - 2025-09-11

### **Multi-Factor Order System Fixes & UI Improvements**
- `src/lib/services/sales/generateOrder.ts` - Fixed multiple order penalty logic, added calculation data storage for tooltips
- `src/lib/services/sales/salesOrderService.ts` - Implemented full wine iteration system with diminishing returns for multiple orders
- `src/lib/services/sales/createCustomer.ts` - Removed unused quantityMultiplier calculation, streamlined customer creation
- `src/lib/types.ts` - Added calculationData interface to WineOrder, removed quantityMultiplier from Customer interface
- `src/lib/database.ts` - Added calculation_data JSONB column support for storing detailed order calculations
- `src/components/pages/Sales.tsx` - Enhanced UI with customer names, country flags, detailed tooltips, and Premium/Discount column
- `src/lib/utils/flags.ts` - New utility for country flag display using flag-icon CSS classes
- `index.html` - Added flag-icon-css stylesheet for country flag display
- `src/lib/constants.ts` - Renamed multipleOrderChanceBonus to multipleOrderPenalty for clarity
- `src/lib/services/gameTickService.ts` - Removed legacy fallback system, streamlined to sophisticated orders only
- **UI Enhancements**: Customer names with country flags, detailed calculation tooltips, order status filtering
- **System Improvements**: Full wine iteration with diminishing returns, calculation data persistence, cleaner console output
- **Bug Fixes**: Multiple order penalty logic, quantity multiplier redundancy, market share scaling issues

---

## Version 0.0022 - 2025-09-11

### **Sales System Multi-Factor Implementation**
- `src/lib/services/sales/createCustomer.ts` - New sophisticated customer generation with regional characteristics
- `src/lib/services/sales/generateOrder.ts` - Enhanced order generation with customer-specific pricing and quantity calculations
- `src/lib/services/sales/salesOrderService.ts` - Added sophisticated order generation system with customer browsing
- `src/lib/constants.ts` - Added CUSTOMER_REGIONAL_DATA and CUSTOMER_NAMES with realistic regional characteristics
- `src/lib/types.ts` - Added Customer interface, CustomerCountry type, and extended WineOrder with customer information
- `src/lib/database.ts` - Updated to support customer_id, customer_name, customer_country fields in wine_orders table
- `src/components/pages/Sales.tsx` - Enhanced UI with order status filtering, customer information display, and improved order management
- `src/components/pages/AdminDashboard.tsx` - Added prestige management tools for testing sophisticated order generation
- `src/components/layout/Header.tsx` - Added prestige display in header for better game state visibility
- `src/lib/services/gameTickService.ts` - Updated to use sophisticated order generation system
- **Multi-Factor System**: Regional purchasing power, wine tradition, and market share influence pricing and quantity
- **Customer Sophistication**: Realistic customer names, country-specific characteristics, and behavioral multipliers
- **Database Schema**: Extended wine_orders table with customer tracking fields
- **UI Improvements**: Order status filtering, customer information display, prestige management tools

---

## Version 0.0021a - 2025-09-11

### **Sales System Code Cleanup**
- `src/lib/utils/wineFilters.ts` - New shared utility for bottled wine filtering logic
- `src/lib/services/sales/pricingService.ts` - Extracted pricing calculations from order generation
- `src/lib/services/sales/generateCustomer.ts` - Updated to use shared wine filtering utility
- `src/lib/services/sales/generateOrder.ts` - Removed pricing logic, cleaned up redundant variables
- `src/lib/services/sales/wineQualityIndexCalculationService.ts` - Removed unused functions (applyFermentationEffects, applyAgingEffects, getGrapeQualityPotential, calculateVintageEffects)
- `src/lib/services/sales/wineValueIndexCalculationService.ts` - Removed unused functions (calculateLandValue, calculateFieldPrestige)
- `src/lib/services/wineBatchService.ts` - Updated import to use new pricingService
- **Code Organization**: Better separation of concerns, eliminated duplicate filtering logic
- **Performance**: Reduced code duplication, improved maintainability
- **Cleanup**: Removed 179 lines of unused code, added 70 lines of focused functionality

---

## Version 0.0021 - 2025-09-11

### **Dynamic Order Generation System**
- `src/lib/services/gameTickService.ts` - New service for time progression and automatic order generation
- `src/lib/services/sales/generateCustomer.ts` - Company prestige-based customer acquisition with sophisticated scaling
- `src/lib/services/sales/generateOrder.ts` - Wine value + quality-based order creation with rejection logic
- `src/lib/services/sales/salesOrderService.ts` - Orchestration service combining customer acquisition and order generation
- `src/lib/services/sales/wineValueIndexCalculationService.ts` - Wine value index calculation from vineyard factors
- `src/lib/services/sales/wineQualityIndexCalculationService.ts` - Wine quality index calculation from wine characteristics
- `src/lib/constants.ts` - Added PRESTIGE_ORDER_GENERATION constants for dynamic scaling
- `src/lib/types.ts` - Extended GameState with company identity (companyName, foundedYear)
- `src/lib/gameState.ts` - Added company initialization, removed incrementWeek wrapper
- `src/components/layout/Header.tsx` - Updated to use gameTickService for time advancement
- `src/components/pages/Profile.tsx` - Enhanced to display company information and years in business
- `src/components/pages/Sales.tsx` - Added customer acquisition chance display with detailed tooltip
- `src/lib/services/vineyardService.ts` - Added pricing factors (landValue, fieldPrestige) to vineyard creation
- `src/lib/services/wineBatchService.ts` - Updated to use new pricing system with vineyard context
- `src/lib/services/salesService.ts` - Simplified to focus on order fulfillment, removed order generation logic
- **Architecture**: Clear separation between customer acquisition (company prestige) and order creation (wine value/quality)
- **UI Enhancement**: Real-time customer acquisition chance display with detailed breakdown
- **Automatic Events**: Weekly order generation through game tick system
- **Mathematical Scaling**: Sophisticated prestige-based order frequency with diminishing returns

---

## Version 0.002 - 2025-09-11

### **Sales System Refactoring & Documentation**
- `docs/salesv2.md` - Comprehensive documentation of advanced sales system components from legacy iterations
- `docs/AIpromt_newpromt.md` - Updated development roadmap for sales system enhancement
- **Documentation**: Detailed analysis of legacy sales system features and recommendations for modernization
- **Planning**: Clear roadmap for implementing sophisticated pricing, importer management, and contract systems
- **Architecture**: Foundation for advanced sales system with multi-factor pricing and dynamic market behavior

---

## Version 0.0012 - 2025-09-10

### **Better Rejection Math**
- `src/lib/services/salesService.ts` - Improved rejection probability calculation with sigmoid mapping and stepped balance
- `src/lib/utils/calculator.ts` - Renamed calculateExtremeQualityMultiplier to calculateAsymmetricalMultiplier, added calculateSymmetricalMultiplier
- `src/lib/constants.ts` - Replaced priceMultiplier with priceMultiplierRange arrays for each order type
- `src/components/pages/Sales.tsx` - Updated UI to use React state management instead of manual data refreshes
- `src/components/layout/Header.tsx` - Added useGameUpdates hook for real-time cash balance updates
- `src/lib/database.ts` - Fixed money storage to use cents (integers) to prevent floating-point precision errors
- **Mathematical Improvements**: Sophisticated price multiplier distribution, better rejection probability curves
- **UI Improvements**: Real-time updates, proper React state management, fixed header cash balance updates
- **Database Fixes**: Resolved 400 errors from floating-point precision issues in money calculations

---

## Version 0.0011 - 2025-09-10

### **Better Sales Math**
- `src/lib/services/salesService.ts` - Implemented sophisticated price multiplier system with symmetrical distribution
- `src/lib/utils/calculator.ts` - Added calculateSymmetricalMultiplier for bell-curve price distribution
- `src/lib/constants.ts` - Widened priceMultiplierRange for all order types with sophisticated probability curves
- **Price System**: Replaced fixed multipliers with ranges using advanced mathematical distributions
- **Customer Behavior**: More realistic bidding patterns with sophisticated probability curves

---

## Version 0.0010 - 2025-09-10

### **Update Status Coregame Implementation + Cleaning of Coregame Features Implemented**
- Updated core game implementation status and cleaned up core game features
- Improved code organization and removed unused functions
- Enhanced system stability and performance

---

## Version 0.0009 - 2025-09-10

### **Finance System Implementation**
- `src/lib/services/financeService.ts` - New comprehensive finance service with transaction management, financial calculations, and Supabase integration
- `src/components/finance/` - Complete finance UI system with FinanceView, IncomeBalanceView, CashFlowView, and UpgradesPlaceholder
- `src/components/ui/` - Added ShadCN UI components: separator, table, tabs for finance interface
- `src/lib/constants.ts` - Added GAME_INITIALIZATION constants for starting values (money, time, prestige)
- `src/lib/gameState.ts` - Refactored to remove direct financial operations, start with 0 money (initial capital via transactions)
- `src/lib/utils/formatUtils.ts` - Consolidated formatting functions, removed redundant formatMoney/formatPercent functions
- `src/components/pages/AdminDashboard.tsx` - Added financial management tools and fixed Supabase clearing for transactions table
- `src/components/pages/Dashboard.tsx` - Removed direct "Add Money" button (moved to Admin Dashboard)
- `src/components/pages/Finance.tsx` - Updated to render new FinanceView component
- `src/hooks/useGameInit.ts` - Added initializeStartingCapital call for proper transaction initialization
- `src/lib/services/salesService.ts` - Updated to use financeService.addTransaction for order fulfillment
- **Database**: Created transactions table with UUID primary key, proper RLS policies
- **Financial Features**: Income/expense tracking, balance sheet calculations, cash flow statements, asset valuation
- **Integration**: All money flows now go through transaction system with proper audit trail

---

## Version 0.0008 - 2025-09-10

### **Player Menu & Notification System Implementation**
- `src/components/ui/` - Added ShadCN UI components: avatar, badge, button, card, dropdown-menu, scroll-area, navigation-menu, accordion, tooltip, toast, toaster
- `src/lib/toast.ts` - New toast notification system with global state management and message dispatching
- `src/components/layout/NotificationCenter.tsx` - In-app notification center with message history, filtering, and real-time updates (renamed from Console)
- `src/components/pages/` - Added player menu pages: Profile, Settings, AdminDashboard, Achievements, Winepedia
- `src/components/layout/Header.tsx` - Integrated player dropdown menu with avatar, notification history access, and reactive state management
- `src/App.tsx` - Added routing for new player menu pages and toast notification system
- `src/lib/utils/utils.ts` - Added global formatTime() function for consistent timestamp formatting
- **Admin Dashboard**: Data clearing functionality for localStorage and Supabase with proper UUID handling for vineyards table
- **Notification System**: Message history with filtering, timestamps, and integration with toast notifications
- **Player Menu**: Dropdown navigation with Profile, Settings, Admin Dashboard, Achievements, Wine-Pedia, and Logout options

---

## Version 0.0007 - 2025-09-09

### **Advanced Mathematical Pricing System**
- `src/lib/utils/calculator.ts` - New centralized mathematical functions with sophisticated pricing calculations
- `src/lib/constants.ts` - Updated quality constants (BASE_QUALITY: 0.5, QUALITY_VARIATION: 2.0) and added PRICING_PLACEHOLDER_CONSTANTS
- `src/lib/types.ts` - Renamed basePrice to finalPrice in WineBatch interface for clarity
- `src/lib/database.ts` - Updated database operations to use final_price instead of base_price
- `src/lib/services/wineBatchService.ts` - Implemented sophisticated pricing: Base Price × Quality Multiplier with bounds checking
- `src/lib/services/salesService.ts` - Updated to use new pricing system with calculateBaseWinePrice() and calculateExtremeQualityMultiplier()
- `src/components/pages/Sales.tsx` - Fixed useGameUpdates hook usage and updated UI to show "Selling Price"
- Database schema migration: Renamed base_price column to final_price in wine_batches table
- **Mathematical Functions**: calculateExtremeQualityMultiplier() with multi-segment scaling (polynomial, logarithmic, linear, exponential curves)
- **Unused Functions**: calculateSteppedBalance(), getRandomAcres(), farmlandAgePrestigeModifier(), calculateOrderAmount() - prepared for future implementation

---

## Version 0.0006 - 2025-09-09

### **Sales System Implementation**
- `src/lib/services/salesService.ts` - New service with generateWineOrder(), fulfillWineOrder(), rejectWineOrder(), getPendingOrders()
- `src/lib/constants.ts` - New centralized constants file with SALES_CONSTANTS and WINE_QUALITY_CONSTANTS
- `src/lib/database.ts` - Added wine_orders table operations, extended wine_batches with quality/balance/basePrice fields
- `src/components/pages/Sales.tsx` - Complete sales UI with wine cellar inventory display and order management
- `src/lib/types.ts` - Added WineOrder, OrderType interfaces and extended WineBatch with quality properties
- `src/lib/gameState.ts` - Added addMoney() and spendMoney() functions for financial transactions
- `src/lib/services/wineBatchService.ts` - Updated to initialize quality/balance/basePrice when creating batches
- Created `wine_orders` table, extended `wine_batches` with quality properties, removed unused `game_states` table
- Sales system: Order generation with 4 customer types, pricing based on Quality × Balance × Base Rate, 6-bottle cases

---

## Version 0.0005 - 2025-09-09 

### **Winery Operations System Implementation**
- `src/lib/services/wineryService.ts` - New service with crushGrapes(), startFermentation(), stopFermentation(), bottleWine(), progressFermentation()
- `src/lib/services/wineBatchService.ts` - Renamed from inventoryService, now handles WineBatch operations with createWineBatchFromHarvest(), updateWineBatch(), formatCompletedWineName()
- `src/lib/database.ts` - Added wine_batches table operations, removed old inventory_items operations
- `src/components/pages/Winery.tsx` - Complete winery operations UI with action buttons, progress tracking, and wine batch management
- `src/lib/types.ts` - Added WineBatch, WineBatchStage, WineBatchProcess interfaces, removed InventoryItem interface
- `src/components/pages/Vineyard.tsx` - Updated harvest to create wine batches directly instead of simple inventory items

### **Database Schema Updates**
- Created `wine_batches` table with stage/process tracking, fermentation progress, and completion dates
- Dropped `inventory_items` table completely (no backward compatibility needed)
- Added proper constraints and RLS policies for wine batch operations

### **Wine Production Flow**
- **Stage Flow**: grapes → must → wine → bottled
- **Process Flow**: none → fermentation → aging → bottled
- **Actions**: Crushing, Start/Stop Fermentation, Progress Tracking, Bottling
- **Completed Wine Format**: "Grape Variety, Vineyard Name, Vintage" with bottle count

---

## Version 0.0004 - 2025-09-09 

### **Vineyard & Inventory System Implementation**
- `src/lib/services/vineyardService.ts` - New service with createVineyard(), plantVineyard(), harvestVineyard(), growVineyard(), resetVineyard()
- `src/lib/services/inventoryService.ts` - New service with addGrapesToInventory(), getAllInventoryItems(), getTotalGrapeQuantity()
- `src/lib/database.ts` - Migrated to separate tables: vineyards, inventory_items, game_state with proper CRUD operations
- `src/components/pages/Vineyard.tsx` - Complete vineyard management UI with create/plant/harvest/grow/reset functionality
- `src/components/pages/Winery.tsx` - Inventory display with grape storage and batch tracking
- `src/hooks/useGameUpdates.ts` - New global subscription system for reactive UI updates
- `src/lib/types.ts` - Added Vineyard, InventoryItem, GrapeVariety, VineyardStatus interfaces
- `package.json` - Added uuid dependency for unique ID generation

### **Code Cleanup & Optimization**
- `src/hooks/useAsyncData.ts` - New reusable hook for async data loading with automatic updates
- `src/lib/types.ts` - Removed unused exports, simplified GrapeVariety type
- `src/lib/database.ts` - Removed unused delete functions, added proper creation date handling
- `src/hooks/useGameUpdates.ts` - Simplified logic, removed unused updateCounter and triggerUpdate
- `src/components/pages/` - Refactored to use useAsyncData hook, removed manual refresh buttons
- `readme.md` - Added documentation for new hooks and database architecture

---

## Version 0.0003 - 2025-09-09 

### **Core Game Implementation**

**Files Changed:**
- `src/lib/types.ts` - Simplified GameState interface, removed playerName/wineryName/gameSpeed/staff/buildings
- `src/lib/gameState.ts` - Added getGameState(), updateGameState(), setGameState(), resetGameState(), incrementWeek()
- `src/lib/database.ts` - Created saveGameState(), loadGameState(), deleteGameState() with Supabase integration
- `src/hooks/useGameInit.ts` - New hook for game initialization with loading/error states
- `src/components/layout/Header.tsx` - Created navigation component with time display and increment button
- `src/components/pages/` - Added Dashboard, Vineyard, Winery, Sales, Finance placeholder components
- `src/lib/formatUtils.ts` - New utility functions: formatCurrency(), formatNumber(), formatPercent()
- `src/lib/emojis.ts` - New emoji mapping constants for navigation and status indicators
- `src/App.tsx` - Integrated Header, page routing, and useGameInit hook
- `src/components/ui/` - Added ShadCN Button, Badge, Avatar components

**Functions Added:**
- `incrementWeek()` - Handles week/season/year progression logic
- `persistGameState()` - Auto-saves game state on every update
- `useGameInit()` - Custom hook for loading saved game state on startup

---

## Version 0.0002 - 2025-09-09 

### 🚀 **Initial Setup with Supabase, React, TypeScript and ShadCN**

#### ✅ **Project Foundation**
- **React + Vite + TypeScript**: Complete frontend setup in root directory
- **Tailwind CSS**: Configured with PostCSS for styling
- **ShadCN UI**: Initialized with neutral color scheme and CSS variables
- **Supabase Integration**: Client configured with new project credentials
- **Environment Setup**: Secure .env configuration with .gitignore

#### 🔧 **Technical Stack**
- **Frontend**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS + ShadCN UI (no custom CSS)
- **Database**: Supabase PostgreSQL with real-time capabilities
- **Build Tools**: Vite with PostCSS and TypeScript compilation
- **Development**: Hot module replacement and TypeScript support

#### 🎮 **Game Architecture**
- **Game State**: Centralized in `src/lib/gameState.ts` with interfaces for:
  - Fields (vineyard management)
  - Wines (production and characteristics)
  - Staff (future implementation)
  - Buildings (future implementation)
- **Supabase Client**: Ready for database operations
- **Clean Structure**: Minimal, maintainable codebase

#### 🛠️ **Development Environment**
- **MCP Tools**: Git and Supabase MCP servers configured
- **Supabase MCP**: Full access configured with anon, service role, and PAT
- **Security**: Environment variables managed through MCP server configuration
- **Git**: Clean commit history with proper .gitignore
- **Dev Server**: Running on http://localhost:3002

---

## Version 0.0001 - 2025-09-09 

### 🌱 **Project Initialization**

#### ✅ **Initial Setup**
- **Repository Creation**: Established project structure and basic documentation
- **Requirements**: Defined project dependencies and environment setup
- **Documentation**: Created initial README and project description

#### 🔧 **Foundation**
- Set up basic project structure with tools/scraper directory
- Defined project goals and architecture overview
- Established development environment and configuration

---

## 📋 **Current Status Summary**

- **Database**: ✅ Fully integrated with Supabase + auto-save/load
- **Frontend**: ✅ Complete React + TypeScript + Tailwind + ShadCN setup
- **Game State**: ✅ Centralized management with time progression
- **UI/UX**: ✅ Basic navigation and page structure complete
- **Development**: ✅ Production-ready codebase with clean architecture

### 🔮 **Next Steps**
- Vineyard management system (planting, harvesting, field management)
- Wine production mechanics (crushing, fermentation, aging)
- Sales system (orders, contracts, pricing)
- Financial management (expenses, income tracking)
- Game progression and balancing