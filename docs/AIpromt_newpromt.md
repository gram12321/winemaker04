We have a comprehensive winery management game built with React/Vite/TypeScript + ShadCN, connected to Supabase. As described in the @readme.md, we have successfully enabled MCP tools for git and supabase.

## ✅ **COMPLETED SYSTEMS** (v0.0091b)

### **Core Game Architecture**
- **Game State Management**: `src/lib/services/core/gameState.ts` - Multi-company support with data isolation
- **Time Progression**: Week-based system with game tick automation (order generation, activity progression, vine aging)
- **Database Integration**: `src/lib/database/database.ts` - Supabase with company-scoped data persistence
- **Real-time Updates**: `src/hooks/useGameUpdates.ts` - Supabase subscriptions

### **Vineyard System**
- **Land Buying**: `src/lib/services/wine/landBuyingService.ts` - Sophisticated vineyard acquisition with realistic property generation
- **Vineyard Management**: `src/lib/services/wine/vineyardService.ts` - CRUD operations with advanced properties
- **Vine Yield System**: Age-based progression (0.02→1.00→decline) with yearly updates
- **Ripeness System**: Seasonal progression with aspect/randomness modifiers
- **Harvest System**: `src/lib/services/wine/harvestCharacteristics.ts` - Vineyard condition modifiers

### **Wine Production System**
- **Wine Characteristics**: 6-characteristic system (acidity, aroma, body, spice, sweetness, tannins)
- **Balance Calculation**: `src/lib/services/wine/balanceCalculator.ts` - Sophisticated cross-trait penalties and synergy rules
- **Wine Production**: Complete grapes → must → wine → bottled pipeline
- **Winepedia Integration**: `DynamicRangeTab` and `CrossTraitPenaltyTab` for system visualization

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
- **Navigation**: Complete player menu with admin dashboard, settings, winepedia
- **Notification System**: `src/components/layout/NotificationCenter.tsx` - Database-persistent notifications
- **Activity System**: Planting, harvesting with work calculation and progress tracking

### **Prestige System**
- **Company Prestige**: Event tracking with decay rates and relationship management
- **Vineyard Prestige**: Vineyard-specific prestige events and calculations
- **Customer Relationships**: Prestige-based relationships with logarithmic scaling


### **Legacy Reference Documentation**
- **v1 Implementation**: `@docs/old_iterations/v1/` - Original JavaScript implementation with complex balance system
- **v3 Implementation**: `@docs/old_iterations/v3/` - Previous React/TypeScript iteration with different architecture
