We have a comprehensive winery management game built with React/Vite/TypeScript + ShadCN, connected to Supabase. As described in the @readme.md, we have successfully enabled MCP tools for git and supabase.

## ✅ **COMPLETED SYSTEMS** 

### **Core Game Architecture**
- **Game State Management**: `src/lib/services/core/gameState.ts` - Multi-company support with data isolation
- **Time Progression**: Week-based system with game tick automation (order generation, activity progression, vine aging)
- **Database Integration**: `src/lib/database/` - Supabase with company-scoped data persistence
- **Real-time Updates**: `src/hooks/useGameUpdates.ts` - Supabase subscriptions
- **Notification System**: `src/lib/services/core/notificationService.ts` - Centralized notification management

### **Vineyard System**
- **Land Buying**: `src/lib/services/vineyard/landSearchService.ts` - Sophisticated land search and acquisition
- **Vineyard Management**: `src/lib/services/vineyard/vineyardService.ts` - CRUD operations with health system
- **Health System**: `src/lib/services/vineyard/clearingService.ts` - Vineyard health tracking and clearing activities
- **Overgrowth System**: Task-specific overgrowth tracking (vegetation, debris, uproot, replant)
- **Vine Yield System**: Age-based progression (0.02→1.00→decline) with yearly updates
- **Ripeness System**: Seasonal progression with aspect/randomness modifiers
- **Harvest System**: `src/lib/services/wine/characteristics/harvestCharacteristics.ts` - Vineyard condition modifiers

### **Wine Production System**
- **Wine Characteristics**: 6-characteristic system (acidity, aroma, body, spice, sweetness, tannins)
- **Balance Calculation**: `src/lib/balance/` - Sophisticated cross-trait penalties and synergy rules
- **Wine Features Framework**: `src/lib/constants/wineFeatures/` - Config-driven features (oxidation, terroir, stuck fermentation, bottle aging, late harvest)
- **Wine Production**: Complete grapes → must → wine → bottled pipeline
- **Winepedia Integration**: `DynamicRangeTab` and `CrossTraitPenaltyTab` for system visualization

### **Staff System**
- **Staff Management**: `src/lib/services/user/staffService.ts` - Staff CRUD operations
- **Team Management**: `src/lib/services/user/teamService.ts` - Team creation and management
- **Staff Search**: `src/lib/services/activity/activitymanagers/staffSearchManager.ts` - Staff recruitment system
- **Wage System**: `src/lib/services/user/wageService.ts` - Wage calculation and payment
- **Staff Assignment**: `src/components/ui/modals/activitymodals/StaffAssignmentModal.tsx` - Activity assignment

### **Activity System**
- **Activity Management**: `src/lib/services/activity/activitymanagers/activityManager.ts` - Main activity coordinator
- **Work Calculators**: `src/lib/services/activity/workcalculators/` - Activity-specific work calculations
- **Activity Types**: Planting, harvesting, clearing, crushing, fermentation, staff search, land search
- **Work Calculation**: Staff-based work progression with multi-tasking penalties and specialization bonuses

### **Advanced Sales System**
- **Customer System**: `src/lib/services/sales/createCustomer.ts` - Regional customers with country-specific characteristics
- **Order Generation**: `src/lib/services/sales/generateOrder.ts` - Sophisticated order creation with rejection logic
- **Pricing System**: `src/lib/services/sales/pricingService.ts` - Multi-factor pricing with wine value + quality indices
- **Regional System**: 5 countries with purchasing power, wine tradition, market share characteristics

### **Finance System**
- **Transaction System**: `src/lib/services/user/financeService.ts` - Complete transaction tracking with audit trail
- **Financial UI**: `src/components/finance/` - Income statements, balance sheets, cash flow analysis
- **Asset Valuation**: Sophisticated calculation of vineyard, wine, and grape values

### **Player Interface**
- **Company System**: Multi-company support with login, profile, highscores, achievements
- **Navigation**: Complete player menu with admin dashboard, settings, winepedia, staff management
- **Achievement System**: `src/lib/services/user/achievementService.ts` - Dynamic tier-based achievements
- **Staff Interface**: `src/components/pages/Staff.tsx` - Staff management with teams and recruitment

### **Prestige System**
- **Company Prestige**: Event tracking with decay rates and relationship management
- **Vineyard Prestige**: Vineyard-specific prestige events and calculations
- **Customer Relationships**: Prestige-based relationships with logarithmic scaling

## 🔧 **Key File Locations for AI Agents**

### **Core Types & Interfaces**
- **Game Types**: `src/lib/types/types.ts` - Core game interfaces and types
- **UI Types**: `src/lib/types/UItypes.ts` - Component prop interfaces
- **Wine Features**: `src/lib/types/wineFeatures.ts` - Wine feature type definitions

### **Service Layer Architecture**
- **Core Services**: `src/lib/services/core/` - Game state, notifications, game tick
- **User Services**: `src/lib/services/user/` - Staff, teams, finance, achievements
- **Vineyard Services**: `src/lib/services/vineyard/` - Vineyard management, land search, clearing
- **Wine Services**: `src/lib/services/wine/` - Wine production, characteristics, features
- **Sales Services**: `src/lib/services/sales/` - Customer management, order generation, pricing
- **Activity Services**: `src/lib/services/activity/` - Activity management and work calculations

### **Database Layer**
- **Core Database**: `src/lib/database/core/` - Companies, users, game state, notifications
- **Activity Database**: `src/lib/database/activities/` - Activities, inventory, vineyard operations
- **Customer Database**: `src/lib/database/customers/` - Customers, orders, prestige events

### **Constants & Configuration**
- **Game Constants**: `src/lib/constants/` - Activity constants, staff constants, vineyard constants
- **Wine Features**: `src/lib/constants/wineFeatures/` - Wine feature configurations
- **Achievement Constants**: `src/lib/constants/achievementConstants.ts` - Achievement definitions

### **Legacy Reference Documentation**
- **v1 Implementation**: `@docs/old_iterations/v1/` - Original JavaScript implementation with complex balance system
- **v3 Implementation**: `@docs/old_iterations/v3/` - Previous React/TypeScript iteration with different architecture
