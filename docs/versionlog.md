# Guideline for versionlog update for AI-Agents
- Use your MCP GIT tools to see the latest X Git update (Do not ever use terminal commands for GIT operations). Each corresponds to a version and should have a separate entry in the @versionlog.md . IE 0.0061, 0.007, 0.0071 and 0.0072
- 5-15 lines for each version entry. Focus on new features/updates, not so much on refactor/reorg/bugfixes
- Include database schema changes, dead table removal, and significant architectural updates
- Use consistent formatting: **Date:** YYYY-MM-DD, **Commit:** [commit hash]

## Version 0.012a - Mobile UI Implementation & Dual UI System
**Date:** 2025-10-01
**Commit:** b8f68c047f291cbd82579ce436c0e676df363986 (latest of 8 commits)

### Changes
- **Mobile Detection:** Added `useIsMobile()` hook with 768px breakpoint detection for responsive UI switching
- **Responsive Sidebar:** Implemented dual sidebar system using ShadCN Sheet component for mobile offcanvas navigation
- **Activity Panel:** Created mobile-friendly sliding panel with floating button trigger; desktop maintains fixed sidebar
- **Table to Cards:** Converted data tables to card-based layouts for mobile views across Sales, Highscores, and WineLog pages
- **Responsive Components:** Enhanced existing components with mobile-specific rendering using Tailwind responsive classes
- **UI Architecture:** Established "Dual UI System" pattern where components render differently based on screen size
- **Mobile Navigation:** Implemented touch-friendly navigation with proper mobile breakpoints and gestures

## Version 0.00951a - Remove duplicate prestige service (cleanup)
**Date:** 2025-09-29
**Commit:** d5f6d86a7a92aa1f734b484bf22420459b3ddb5f

### Changes
- **Removal:** Deleted legacy `src/lib/services/core/prestigeService.ts` duplicate to avoid conflicts with new `services/prestige/*` API

## Version 0.00951 - Standardization: Database layer and service imports
**Date:** 2025-09-29
**Commit:** c072a464a1fb8b1a4772b772c14d2ade222db767

### Changes
- **DB Core:** Introduced `src/lib/database/core/` (`supabase.ts`, `gamestateDB.ts`, `notificationsDB.ts`) and migrated imports
- **Activities/Inventory:** Added focused DB modules: `activities/activityDB.ts`, `activities/inventoryDB.ts`, `activities/vineyardDB.ts`
- **Customers/Prestige:** New `customers/prestigeEventsDB.ts`; routed prestige queries via DB layer
- **Prestige:** Standardized UI imports to `@/lib/services/prestige/prestigeService` (Header, PrestigeModal, hooks)
- **Sales/Vineyard:** Split DB access from services; `Sales.tsx` now uses `customers/salesDB` and service `relationshipService`
- **Winery UX:** Reworked `CrushingOptionsModal` to call `winery/crushingManager`; Winery page adds "Balance Analysis" modal
- **Winepedia:** Unified UI cards (`GridCard`, `SimpleCard`); added `BalanceScoreBreakdown` and slider components; cleanup across tabs

## Version 0.0095 - Standardization: Modal components and UX polish
**Date:** 2025-09-29
**Commit:** 920c57bacb4ba635786467ca19fa0eee42369d42

### Changes
- **Modals:** Added doc headers and structure for `BalanceBreakdownModal`, `CrushingOptionsModal`, `HarvestOptionsModal`, `PlantingOptionsModal`
- **Winery:** Integrated balance analysis and crushing flow via modals; removed inline crush action
- **UI Kit:** Enhanced `ActivityOptionsModal` (tooltips, max sizes, layout), exported new modal/components from `ui/index.ts`
- **Winepedia:** Light refactors for consistent `@/components/ui` imports and layout wrappers

## Version 0.0094 - Major correction to balance system
**Date:** 2025-09-28
**Commit:** e89d22f737e70391a0011d4b45ae0e548094980f

### Changes
- **Balance Engine:** Introduced new modular balance engine under `src/lib/balance/`:
  - `calculations/`: `balanceCalculator.ts`, `rangeCalculator.ts`, `ruleCalculator.ts`
  - `config/`: `rangeAdjustments.ts`; `RULES` integration
- **UI:** Added `BalanceScoreBreakdown` component with detailed penalty/synergy breakdown; integrated into Winery and Winepedia
- **Characteristic UI:** `WineCharacteristicsDisplay` now can show balance score; numeric tooltips use fixed decimals
- **Hooks:** `useWineBalance` updated to use new engine and configs
- **Winery:** Balance analysis modal + crushing modal; harvest breakdown uses stored `breakdown` or recomputes via new services

## Version 0.0093a - Winepedia cleanup & shared UI wrappers
**Date:** 2025-09-26
**Commit:** 0734849d058754bb354e2f4be22d0c7e58436955

### Changes
- **UI Wrappers:** Added `SimpleCard` and `GridCard` in `ui/shadCN/card.tsx`; replaced ad-hoc Card uses across Winepedia and Finance
- **Winepedia:** Centralized sliders (`CharacteristicSlider`, `CharacteristicSliderGrid`); simplified tabs and copy
- **Hooks:** New `useCustomerData` hook consolidating customer loading and relationship breakdowns
- **Finance:** `CashFlowView`, `IncomeBalanceView` migrated to `SimpleCard`

## Version 0.0093 - Finance system cleanup
**Date:** 2025-09-26
**Commit:** df1b76c97215d48b50c966c80d8ef0f3b7c04962

### Changes
- **Admin Tools:** Improved full DB reset ordering and error handling; added notifications cleanup; safer composite key deletes
- **Pages:** Import path fixes for shared UI types and components; tightened sales/admin page structures

## Version 0.0092 - Docs: App-wide update
**Date:** 2025-09-26
**Commit:** f4e3974806caa617bba2673704d212895d8fec76

### Changes
- **README:** Expanded implemented systems; noted crushing activity methods and removed legacy “Green Flavors” note
- **Docs:** Synchronized terminology and current feature set across app-wide documentation

## Version 0.0091b - Documentation & Code Cleanup
**Date:** 2025-09-26
**Commit:** 64c02dba08576429c42d7ff13fa35a7195e1a286

### Changes
- **Documentation Updates:**
  - `docs/winecharacteristicsBalancesystem.md` - Significantly reduced and focused documentation for versionlog compatibility
  - Updated terminology: "Synergy System" → "Cross-Trait System", "Vineyard Starting Deltas" → "Harvest Specific Characteristics"
  - Added new balance calculation terminology: Inside Distance, Outside Distance, Penalty, Total Distance
  - `readme.md` - Updated database schema section with current 15 active tables, removed dead table references
- **Code Cleanup:**
  - `src/lib/services/wine/balanceCalculator.ts` - Removed redundant placeholder functions `getSynergyBonuses()` and `getRegionalModifiers()`
  - Enhanced Services & Components documentation with Winepedia and Winery integration details
- **Database Cleanup:**
  - Removed dead `game_state` table from database (replaced by `companies` table for multi-company support)
  - Updated database schema documentation to reflect current 15-table structure

## Version 0.0091a - Enhanced Penalty System & TypeScript Improvements
**Date:** 2025-09-25
**Commit:** f570af857eccad193729bf83e9f911eefb38ebfc

### Changes
- **Penalty System Enhancements:**
  - Enhanced cross-trait penalty multipliers with more sophisticated scaling
  - Improved penalty calculation algorithms for better balance scoring
- **TypeScript Improvements:**
  - Enhanced type definitions for balance calculations
  - Improved type safety across wine characteristics system
- **Code Quality:**
  - Better error handling and validation
  - Improved code organization and maintainability

## Version 0.0091 - Cross-Trait Balance System & Enhanced Winepedia
**Date:** 2025-09-25
**Commit:** f45b2b86998aa5de9ef9bc21a56d3b0fe599c1ea

### Changes
- **Cross-Trait Balance System:**
  - `src/lib/services/wine/balanceCalculator.ts` - Implemented sophisticated cross-trait penalty scaling and synergy reductions
  - `src/lib/constants/balanceAdjustments.ts` - Configuration-driven dynamic range adjustments and penalty multipliers
  - 7 synergy rules: acidity+tannins, body+spice, aroma+body+sweetness combinations
- **Enhanced Winepedia:**
  - `src/components/winepedia/CrossTraitPenaltyTab.tsx` - Interactive visualization of cross-trait penalties and synergies
  - `src/components/winepedia/DynamicRangeTab.tsx` - Interactive calibration panel for range adjustments
  - Enhanced `CharacteristicBar` component with dynamic range visualization
- **UI Integration:**
  - Updated `Winery.tsx` to use new characteristic display system
  - Real-time balance calculations with live preview

## Version 0.009a - Dynamic Range Adjustments
**Date:** 2025-09-25
**Commit:** a6fbfb9e2b4d9ded29ba870d6bcc5a7d050e10a9

### Changes
- **Dynamic Range System:**
  - `src/lib/services/wine/balanceCalculator.ts` - Implemented config-driven range adjustments
  - High acidity shifts sweetness range down, high body shifts spice/tannins up
  - Cross-trait effects with penalty multipliers based on characteristic deviations
- **Interactive UI:**
  - `src/components/winepedia/DynamicRangeTab.tsx` - Interactive sliders with live preview
  - Real-time range adjustment visualization
  - Smooth, continuous math (no stepwise penalties)

## Version 0.009 - Harvest Characteristics & Differentiated Balance Ranges
**Date:** 2025-09-25
**Commit:** 3e3a06b6b2b72e2a674ead122948483f28dfce8d

### Changes
- **Harvest Characteristics System:**
  - `src/lib/services/wine/harvestCharacteristics.ts` - Vineyard condition modifiers at batch creation
  - Ripeness effects: late harvest → sweetness↑, acidity↓, tannins↑, body↑, aroma↑
  - Quality factor effects: influences body, aroma, tannins (color-aware for reds vs whites)
  - Altitude effects: higher → acidity↑, aroma↑, body↓
  - Regional suitability effects: better regions → body↑, aroma↑
- **Differentiated Balance Ranges:**
  - `src/lib/constants/grapeConstants.ts` - Per-characteristic ranges: acidity [0.4,0.6], aroma [0.3,0.7], body [0.4,0.8], spice [0.35,0.65], sweetness [0.4,0.6], tannins [0.35,0.65]
  - Replaced flat 0.4-0.6 ranges with characteristic-specific balanced ranges
  - Deterministic grape base characteristics + vineyard modifiers = starting characteristics

## Version 0.008b - Code Reorganization & Activity System Updates
**Date:** 2025-09-24
**Commit:** 9fd468362528c0a6603b587d92fc3c6ee9c17901

### Changes
- **Code Reorganization:**
  - Improved code structure and organization
  - Better separation of concerns across services
  - Enhanced maintainability and readability
- **Activity System Updates:**
  - Removed genetic updates for activity system
  - Streamlined activity management
  - Improved activity workflow efficiency

## Version 0.008 - Bookkeeping Activity System
**Date:** 2025-09-24
**Commit:** 97dd8f9af4094204433bc962de08ab0d131e429e

### Changes
- **Bookkeeping Activity:**
  - New bookkeeping activity system for financial management
  - Enhanced financial tracking and reporting
  - Improved accounting workflow integration
- **Activity System:**
  - Better activity categorization and management
  - Enhanced work calculation for bookkeeping tasks
  - Improved activity progress tracking

## Version 0.0073 - Vine Yield System & Yield Projection Tab
**Date:** 2025-09-24
**Commits:** 2d8a6b4 (0.0073) + c4f17d0 (0.0073a)

### Changes
- **Vine Yield System:**
  - `src/lib/services/wine/vineyardManager.ts` - Added persistent `vineYield` property to vineyards with yearly progression
  - `src/lib/database/database.ts` - Added `vine_yield` column to vineyards table with migration
  - `src/lib/services/core/gameTick.ts` - Integrated `updateVineyardVineYields()` into yearly game tick
  - `src/components/pages/Vineyard.tsx` - Added vine yield progress bar display in vineyard UI
- **Yield Projection Tab:**
  - `src/components/winepedia/YieldProjectionTab.tsx` - New interactive yield projection system with configurable sliders
  - `src/components/winepedia/MathematicalModelsTab.tsx` - Enhanced with yield projection integration
  - `src/components/winepedia/index.ts` - Added YieldProjectionTab to winepedia exports
- **Vine Yield Progression:**
  - Age-based progression: 0.02 → 0.10 → 0.30 → 0.60 → 0.85 → 1.00 (ages 0-5)
  - Peak years (5-15): maintain at 1.00
  - Linear decline (15-29): -0.0267 per year to 0.60
  - Exponential decay (30+): 0.6 × 0.85^(age-30) with randomness
- **Database Migration:**
  - Added `vine_yield` column to vineyards table with DECIMAL(5,3) type
  - Default value 0.02, no upper cap, minimum 0.01
- **UI Enhancements:**
  - Interactive yield projection with sliders for country, region, grape, hectares, density, ripeness, age, health
  - Min/max bands visualization showing possible yield ranges from randomness
  - Vine yield progress bars in vineyard management interface

## Version 0.0072 - Harvest: Combine Compatible Wine Batches
**Date:** 2025-09-24
**Commit:** f0918b076d2c014461ccc78dcdb66b624de86ef5

### Changes
- **Batch Combination:**
  - `src/lib/services/wine/wineBatchService.ts` - Combine compatible batches (same `vineyardId` and vintage) instead of creating new ones per tick
  - Weighted averaging for `quality`, `balance`, and all `WineCharacteristics`; `quantity` is summed
  - `finalPrice` recalculated after combination using existing pricing service
- **Harvest Flow:**
  - Partial harvest ticks now aggregate into a single ongoing batch for the vintage (grapes stage)
  - Keeps DB storage clean and improves downstream sales/stock logic
- No schema changes; `saveWineBatch()` upsert continues to persist combined batches

## Version 0.0071 - Harvest Modal, Activity, and Work Calculation
**Date:** 2025-09-24
**Commit:** 73d08eb6de754efd362eebe0c587bdd605bbb682

### Changes
- **Harvest System:**
  - `src/components/ui/modals/HarvestOptionsModal.tsx` - Interactive modal to start harvests with parameters
  - `src/lib/services/activity/activityManager.ts` - Partial harvesting during activity progress and finalization
  - `src/lib/services/activity/VineyardWorkCalculator.ts` - Added harvest work calculation with grape fragility and altitude modifiers
  - `src/lib/services/wine/vineyardManager.ts` - Expected yield calculation used by harvest work and UI
- **UX:** Progress/status updates on vineyard while harvesting and completion notifications

## Version 0.007 - Planting Flow & Ripeness Progression
**Date:** 2025-09-24
**Commit:** be61d7ab7612b817f0ea0247671ee8ef95b5e6e6

### Changes
- **Planting System:**
  - `src/components/ui/activities/PlantingOptionsModal.tsx` - Planting options integrated with activity system
  - `src/lib/services/activity/VineyardWorkCalculator.ts` - Planting work calculation including density, fragility, altitude
  - `src/lib/services/wine/vineyardService.ts` - Plant vineyard action wired to activities and prestige
- **Ripeness Progression:**
  - `src/lib/services/wine/vineyardManager.ts` - Weekly ripeness increase by season with aspect/randomness modifiers
  - `src/lib/constants/vineyardConstants.ts` - Seasonal ripeness rates and randomness ranges

## Version 0.0061 - Stabilization & Minor Improvements
**Date:** 2025-09-23
**Commit:** 9566db47dd9745925565eeea0e4426ce2bbd7e6d

### Changes
- General codebase stabilization and organization to support upcoming planting/harvest features
- Polished activity/service boundaries and barrel exports for consistency
- No schema changes; behavior preserved with minor fixes

## Version 0.006 - Activity System & Activity Panel Implementation
**Date:** 2025-09-23
**Commit:** ceb0aad6072f06cf0d458406c0f14201c9c632b3

### Changes
- **Activity System:**  
  - `src/lib/services/activityManager.ts` - Centralized activity CRUD, progress, and completion logic  
  - `src/lib/database/activityService.ts` - Supabase persistence with RLS  
  - `src/lib/types/activity.ts` - Activity interface with work tracking  
  - `src/lib/services/work/workCalculator.ts` - WorkCategory enum now UPPERCASE

- **UI & Integration:**  
  - `src/components/layout/ActivityPanel.tsx` - Sidebar with hidden/minimized/full states  
  - `src/components/ui/activities/ActivityCard.tsx` - Activity card with drag, minimize, cancel  
  - `src/components/ui/shadCN/progress.tsx` - v3-style progress bar  
  - `src/components/ui/shadCN/sidebar.tsx` - Sidebar structure  
  - Drag & drop via `@dnd-kit`, with event fixes  
  - Planting now creates activities (`PlantingOptionsModal.tsx`, `Vineyard.tsx`)  
  - `src/App.tsx` - ActivityPanel added to layout  
  - `src/lib/services/gameTick.ts` - Activities progress 50 work units/tick, auto-complete, persist  
  - New: `sheet.tsx`, `skeleton.tsx`, `use-mobile.tsx`, activity icons  
  - Updated: `tailwind.config.js`, `src/index.css`, barrel exports

### Features
- Generic activity system (planting, admin, finance, etc)
- Visual work progress, time estimates, and persistence
- Activities resume after refresh, with notificationService integration
- Responsive, collapsible activity panel with color-coded categories

## Version 0.005X1 - Hotfix Active Company in LocalStorage
**Date:** 2025-09-22
**Commit:** 2dd7b1160adfb40384f9d574a9c67b6d956b4183

### Changes
- **LocalStorage Cleanup:**
  - Removed `activeCompany` from localStorage cleanup
  - Simplified company persistence to only store `lastCompanyId`
  - Cleaner localStorage management in Header component

- **Files Modified:**
  - `src/components/layout/Header.tsx` - Updated localStorage cleanup
  - `src/lib/services/gameState.ts` - Simplified persistence logic

## Version 0.005X - Hotfix Notification in LocalStorage
**Date:** 2025-09-22
**Commit:** 281f061bf6c15f88f53a2018056ca64ec6fe329d

### Changes
- **Notification System Enhancement:**
  - Migrated notifications from localStorage to Supabase database
  - Added notification persistence with company-specific storage
  - Enhanced notification loading and clearing functionality

- **Database Integration:**
  - `src/lib/database/database.ts` - Added notification CRUD operations
  - `src/components/layout/NotificationCenter.tsx` - Updated to use database storage
  - Added `DbNotificationType` and `DbNotificationRecord` interfaces

- **Features:**
  - Notifications now persist across sessions
  - Company-specific notification storage
  - Improved notification loading performance

## Version 0.00523 - Reorganize UI Directory
**Date:** 2025-09-22
**Commit:** 7923136c8265a4fdcf769afdd9f71334369de382

### Changes
- **UI Directory Restructure:**
  - Moved ShadCN components to `src/components/ui/shadCN/`
  - Moved modals to `src/components/ui/modals/`
  - Moved custom components to `src/components/ui/components/`
  - Updated all import paths across the codebase

- **Files Reorganized:**
  - All ShadCN components moved to dedicated subdirectory
  - Modal components centralized in `modals/` folder
  - Updated barrel exports in `src/components/ui/index.ts`
  - Fixed import paths in all affected components

## Version 0.00522 - Fix Grape Fragility & Implement Grape Suitability
**Date:** 2025-09-22
**Commit:** 88316b95e24d24977a071b933c3b0e70da4419d5

### Changes
- **Grape System Improvements:**
  - Fixed grape fragility affecting work calculations (replaced suitability)
  - Implemented grape suitability and natural yield in harvest calculations
  - Added comprehensive grape information in Winepedia

- **New Components:**
  - `src/components/winepedia/GrapeInfoView.tsx` - Detailed grape information modal
  - `src/lib/constants/grapeConstants.ts` - Unified grape data structure
  - `src/lib/constants/index.ts` - Centralized constants exports

- **Enhanced Harvest System:**
  - Yield now considers grape suitability and natural yield
  - Work calculations use grape fragility instead of suitability
  - Wine batches include grape metadata (color, fragility, oxidation)

- **Winepedia Enhancements:**
  - Interactive grape variety selection
  - Regional suitability display
  - Grape characteristics visualization

## Version 0.00521 - Vineyard UI Update Fix
**Date:** 2025-09-20
**Commit:** 24e4db68901ec91e92e9317f2a3c8706f77c408e

### Changes
- **Category System Integration:**
  - Added `category` prop to `ActivityOptionsModal`
  - Category gets included in submitted options
  - Updated `PlantingOptionsModal` to pass `WorkCategory.PLANTING`

- **Database Fixes:**
  - Fixed vineyard density defaulting to 5000 instead of 0 for unplanted vineyards
  - Improved prestige calculation on vineyard creation
  - Enhanced vineyard loading with refreshed prestige values

- **Files Modified:**
  - `src/components/ui/activities/PlantingOptionsModal.tsx` - Added category prop
  - `src/components/ui/activities/activityOptionsModal.tsx` - Enhanced with category support
  - `src/lib/database/database.ts` - Fixed density defaulting
  - `src/lib/services/wine/vineyardService.ts` - Improved prestige handling

## Version 0.0052 - Vineyard Planting Overlay
**Date:** 2025-09-20
**Commit:** 3056e92777d23e80a91225b237697f026fbd143b

### Changes
- **New Planting System:**
  - `src/components/ui/activities/PlantingOptionsModal.tsx` - Advanced planting modal
  - `src/components/ui/activities/activityOptionsModal.tsx` - Generic activity options modal
  - `src/components/ui/activities/workCalculationTable.tsx` - Work calculation display

- **Work Calculation System:**
  - `src/lib/services/work/workCalculator.ts` - Core work calculation logic
  - `src/lib/services/work/index.ts` - Work service exports
  - Generic `calculateTotalWork()` function for all activities

- **Vineyard Enhancements:**
  - Reactivated `density` parameter in `Vineyard` interface
  - Updated harvest calculations to use density
  - Enhanced planting with grape variety and density selection

- **UI Improvements:**
  - Replaced simple grape input dialog with comprehensive planting modal
  - Added work calculation display with factors and modifiers
  - Integrated grape suitability and altitude factors in work calculations
  - Updated vineyard table to display density information

## Version 0.0051 - 2025-09-19

### **Vineyard Land Buying System & Name Generation**
- `src/lib/services/wine/landBuyingService.ts` - New comprehensive land buying service with vineyard purchase options generation
- `src/components/ui/land-buying-modal.tsx` - New modal component for vineyard property selection with detailed characteristics display
- `src/components/pages/Vineyard.tsx` - Replaced simple vineyard creation with sophisticated land buying system, added country flags and rating displays
- `src/lib/services/wine/vineyardService.ts` - Added purchaseVineyard function with financial integration and auto-generated vineyard names
- `src/lib/constants/names.ts` - New centralized name constants file with comprehensive name databases for all countries
- `src/lib/constants/constants.ts` - Moved customer name data to dedicated names.ts file for better organization
- `src/lib/services/sales/createCustomer.ts` - Updated to use new centralized name constants
- `src/lib/services/wine/vineyardValueCalc.ts` - Added getAspectRating and getAltitudeRating functions for display purposes
- `src/lib/utils/flags.ts` - Updated flag system to use flag-icon-css classes instead of emoji flags
- `src/lib/utils/utils.ts` - Added getBadgeColorClasses function for rating display with color-coded badges
- `src/components/pages/Profile.tsx` - Added null check for invalid dates in formatLastPlayed function
- `src/lib/services/user/companyService.ts` - Fixed lastPlayed date handling for null values
- **Architecture**: Complete vineyard acquisition system with realistic property generation, financial integration, and sophisticated UI
- **UI Enhancement**: Interactive land buying modal with property characteristics, affordability checking, and visual rating displays
- **Name System**: Centralized name generation for both vineyards and customers with country-specific databases

## Version 0.00492 - 2025-09-19

### **Code Cleanup & Optimization**
- `src/components/pages/Settings.tsx` - Removed unused import for cleaner code structure
- `src/components/pages/WineLog.tsx` - Streamlined imports and removed unused type imports for better performance
- `src/components/pages/Winepedia.tsx` - Removed commented code and unused chart generation function to improve maintainability

## Version 0.00491b - 2025-09-18

### **Constants File Organization**
- `src/lib/constants/constants.ts` - Moved constants.ts to organized constants directory structure
- Updated all import paths across the application to use new constants location
- Improved code organization with better file structure for maintainability

## Version 0.00491a - 2025-09-18

### **Game Initialization & Customer Management Fixes**
- `src/App.tsx` - Fixed duplicate initialization issues and improved company switching logic
- `src/components/pages/Login.tsx` - Removed unused imports and improved auto-login functionality
- `src/hooks/useGameInit.ts` - Removed redundant initialization hook to prevent double initialization
- `src/main.tsx` - Disabled React StrictMode in development to prevent double initialization
- Fixed customer creation and initialization to prevent duplicate processes

## Version 0.00491 - 2025-09-18

### **Company Login & Customer Creation Bug Fixes**
- `src/App.tsx` - Enhanced game initialization with proper company switching guards
- `src/components/layout/Header.tsx` - Improved localStorage cleanup with selective key removal
- `src/components/pages/Login.tsx` - Fixed auto-login timing to occur after companies are loaded
- `src/hooks/useGameInit.ts` - Added initialization guards to prevent duplicate customer creation
- Fixed customer creation and company login flow issues

## Version 0.0048a - 2025-09-17

### **Customer Recreation Prevention**
- `src/App.tsx` - Simplified game initialization to rely on useGameInit hook
- `src/lib/database/customerDatabaseService.ts` - Enhanced customer existence checking with detailed logging
- `src/lib/services/sales/createCustomer.ts` - Added comprehensive logging and prevention of customer recreation on reload
- Fixed issue where customers were being recreated on page reload instead of loading existing ones

## Version 0.0047a - 2025-09-16

### **Prestige Service & Vineyard Calculation Fixes**
- `src/lib/database/prestigeService.ts` - Major refactoring to use centralized company ID management and improved vineyard prestige calculations
- `src/lib/database/relationshipBreakdownService.ts` - Updated to use new prestige service API
- `src/lib/services/gameState.ts` - Improved company value prestige calculation with logarithmic scaling
- Enhanced vineyard prestige calculation for non-planted vineyards and fixed company ID handling

## Version 0.0049 - 2025-09-15

### **Prestige Service & Database Integration**
- `src/lib/database/prestigeService.ts` - Complete prestige system with vineyard prestige calculation, database integration, and service layer architecture
- `src/lib/services/wine/vineyardValueCalc.ts` - Enhanced vineyard value calculation service with prestige integration
- `src/lib/database/relationshipBreakdownService.ts` - New relationship breakdown service for database operations
- `src/lib/utils/calculator.ts` - Updated calculator utilities to support prestige calculations
- `src/components/pages/Vineyard.tsx` - Enhanced vineyard page with prestige integration and improved UI

## Version 0.0048 - 2025-09-15

### **Vineyard Value Calculation & Service Architecture**
- `src/lib/services/wine/vineyardValueCalc.ts` - New vineyard value calculation service with comprehensive vineyard valuation logic
- `src/lib/database/prestigeService.ts` - Enhanced prestige service with better database integration and vineyard prestige calculations
- `src/lib/utils/calculator.ts` - Updated calculator utilities to support vineyard value calculations
- `src/components/pages/Vineyard.tsx` - Enhanced vineyard page with value calculation integration

## Version 0.0047 - 2025-09-15

### **Prestige System & Database Services**
- `src/lib/database/prestigeService.ts` - New prestige service with comprehensive prestige calculation system
- `src/lib/database/relationshipBreakdownService.ts` - Enhanced relationship breakdown service with better database operations
- `src/lib/services/wine/vineyardValueCalc.ts` - New vineyard value calculation service
- `src/lib/utils/calculator.ts` - Updated calculator utilities to support prestige calculations
- `src/components/pages/Vineyard.tsx` - Enhanced vineyard page with prestige integration

## Version 0.0046 - 2025-09-15

### **Database Services & Relationship Management**
- `src/lib/database/relationshipBreakdownService.ts` - New relationship breakdown service for database operations
- `src/lib/database/prestigeService.ts` - New prestige service with database integration
- `src/lib/services/wine/vineyardValueCalc.ts` - New vineyard value calculation service
- `src/lib/utils/calculator.ts` - Updated calculator utilities to support new database services
- `src/components/pages/Vineyard.tsx` - Enhanced vineyard page with new service integrations

## Version 0.0045 - 2025-09-15

### **Vineyard Constants & Measurement System**
- `src/lib/constants/vineyardConstants.ts` - New comprehensive vineyard constants with country-region mapping, soil types, altitude ranges, aspect ratings, market data, and grape suitability
- `src/lib/database/database.ts` - Updated vineyard storage to use hectares instead of acres
- `src/lib/services/user/financeService.ts` - Updated farmland value calculation to use hectares (€40k per hectare)
- `src/lib/services/wine/vineyardService.ts` - Updated default vineyard creation to use hectares (0.5 hectares), simplified placeholder values
- `src/lib/types.ts` - Changed vineyard interface from acres to hectares
- `src/lib/utils/calculator.ts` - Renamed getRandomAcres() to getRandomHectares() with updated size ranges
- `src/lib/utils/index.ts` - Updated exports to use getRandomHectares
- `docs/coregame.md` - Updated documentation to reflect hectare measurements
- `docs/versionlog.md` - Fixed function name reference
- `readme.md` - Updated vineyard creation description to use hectares
- **Architecture**: Comprehensive vineyard constants system with realistic regional data
- **Measurement**: Complete migration from acres to hectares for international standardization
- **Data**: 25 regions across 5 countries with soil types, altitude ranges, aspect ratings, and grape suitability scores

---

## Version 0.0044 - 2025-09-15

### **Grape Varieties & Vineyard Interface Expansion**
- `src/lib/types.ts` - Expanded Vineyard interface with vineAge, soil, altitude, aspect, landValue, vineyardPrestige properties
- `src/lib/database/database.ts` - Updated vineyard storage to include new properties (vine_age, soil, altitude, aspect, vineyard_prestige)
- `src/lib/database/prestigeService.ts` - Updated to use vineyardPrestige instead of fieldPrestige
- `src/lib/services/gameTick.ts` - Added updateVineyardAges() function for yearly vine aging
- `src/lib/services/sales/wineValueIndexCalculationService.ts` - Updated to use vineyardPrestige
- `src/lib/services/wine/vineyardService.ts` - Updated vineyard creation with new properties, changed default region to Bordeaux
- `src/components/pages/Vineyard.tsx` - Fixed vineyard planting logic to use grape property instead of isPlanted
- `src/components/pages/Winepedia.tsx` - Updated grape variety display with collapsible characteristics
- `src/components/pages/Winery.tsx` - Simplified wine characteristics display with built-in collapsible functionality
- `src/components/ui/CharacteristicBar.tsx` - Enhanced with collapsible functionality, alphabetical sorting, and improved UI
- `docs/winecharacteristicsBalancesystem.md` - Updated documentation for collapsible functionality
- **Vineyard System**: Complete expansion with realistic vineyard properties (vine age, soil composition, altitude, aspect)
- **UI Enhancement**: Collapsible wine characteristics display with improved user experience
- **Game Mechanics**: Annual vine aging system for realistic vineyard progression

---

## Version 0.0043 - 2025-09-15

### **Wine Characteristics Alpha 2 - Service Organization**
- `src/lib/constants.ts` - Added BASE_BALANCED_RANGES, BASE_GRAPE_CHARACTERISTICS, and GRAPE_VARIETY_INFO constants
- `src/lib/services/wine/balanceCalculator.ts` - Moved from services/ to services/wine/, updated to use constants, removed wrapper functions
- `src/lib/services/user/` - New directory structure for user-related services (authService, companyService, financeService, highscoreService, userSettingsService)
- `src/lib/services/sales/` - New directory structure for sales services (salesService, generateOrder, etc.)
- `src/lib/services/wine/` - New directory structure for wine services (vineyardService, wineBatchService, wineryService, balanceCalculator)
- `src/lib/services/index.ts` - Updated barrel exports to reflect new directory structure
- `src/lib/types.ts` - Updated GrapeVariety type to include all 5 varieties (Barbera, Chardonnay, Pinot Noir, Primitivo, Sauvignon Blanc)
- `src/components/ui/CharacteristicBar.tsx` - Updated to use constants and improved color coding with getColorClass utility
- `src/components/pages/` - Updated all page components to use new service import paths
- `src/hooks/useWineBalance.ts` - Updated to use new service structure
- `src/lib/utils/utils.ts` - Added wine quality categorization functions (getWineQualityCategory, getWineQualityDescription, getColorCategory)
- `src/lib/utils/index.ts` - Updated exports to include new utility functions
- **Architecture**: Complete service reorganization with logical directory structure (user/, sales/, wine/)
- **Constants**: Centralized wine characteristics and grape variety data
- **UI Enhancement**: Improved wine quality display with categorization and color coding
- **Code Organization**: Better separation of concerns with specialized service directories

---

## Version 0.0042 - 2025-09-15

### **Wine Characteristics Alpha - Core Implementation**
- `src/lib/types.ts` - Added WineCharacteristics and BalanceResult interfaces, extended WineBatch with characteristics property
- `src/lib/services/balanceCalculator.ts` - New service with calculateWineBalance, generateDefaultCharacteristics functions
- `src/lib/services/wineBatchService.ts` - Updated to generate wine characteristics and calculate balance during batch creation
- `src/lib/database/database.ts` - Added characteristics storage to wine_batches table
- `src/components/ui/CharacteristicBar.tsx` - New component with visual balance ranges, value markers, and legend
- `src/components/ui/index.ts` - Added CharacteristicBar exports
- `src/hooks/useWineBalance.ts` - New hooks for wine balance calculations (useWineBatchBalance, useFormattedBalance, useBalanceQuality)
- `src/hooks/index.ts` - Added wine balance hook exports
- `src/components/pages/Winery.tsx` - Added wine characteristics display for all wine batches with balance information
- `src/components/pages/Winepedia.tsx` - Added grape variety characteristics display with interactive bars
- `docs/winecharacteristicsBalancesystem.md` - Updated documentation with Phase 1 implementation details
- **Wine System**: Complete wine characteristics system with 6 characteristics (acidity, aroma, body, spice, sweetness, tannins)
- **Balance Calculation**: Phase 1 implementation with static balanced ranges and distance-based scoring
- **UI Components**: Visual characteristic bars with balance ranges, expandable displays, and quality indicators
- **Database Integration**: Wine characteristics storage and retrieval system

---

## Version 0.0041a - 2025-09-15

### **Winepedia Freeze Bug Fix**
- `src/components/pages/Winepedia.tsx` - Fixed React hooks order issue by creating loadCustomersData callback function
- **Bug Fix**: Resolved Winepedia page freezing caused by improper hook usage in conditional data loading
- **Performance**: Improved data loading pattern with proper React hooks compliance

---

## Version 0.0041 - 2025-09-15

### **Wine Characteristics Initial Setup**
- `src/components/ui/BalanceVisualizer.tsx` - Created placeholder component for future wine balance visualization
- **Setup**: Initial preparation for wine characteristics system implementation

---

## Version 0.004 - 2025-09-14

### **Documentation & Planning for Wine Characteristics System**
- `docs/winecharacteristicsBalancesystem.md` - New comprehensive documentation for wine characteristics and balance system
- `docs/AIpromt_newpromt.md` - Updated development roadmap with customer system completion and wine characteristics planning
- `docs/versionlog.md` - Added Version 0.0032 entry with code architecture overhaul details
- `readme.md` - Updated with barrel export system documentation and enhanced hooks information
- **Documentation**: Complete planning and documentation for wine characteristics system implementation
- **Architecture**: Detailed roadmap for Phase 1-4 implementation of wine balance calculations
- **Planning**: Foundation for sophisticated wine quality and balance system with archetype matching

---

## Version 0.0032 - 2025-09-14

### **Code Architecture & Import System Overhaul**
- `src/components/ui/index.ts` - New barrel export system for all UI components, eliminating import duplication
- `src/hooks/index.ts` - New barrel export system for all custom hooks with centralized access
- `src/lib/services/index.ts` - New barrel export system for all services with organized exports
- `src/lib/utils/index.ts` - New barrel export system for all utility functions with consolidated imports
- `src/components/UItypes.ts` - New shared component interfaces for consistent prop types across components
- `src/hooks/useLoadingState.ts` - New simplified loading state hook with withLoading wrapper for async operations
- `src/hooks/useGameState.ts` - Enhanced with useGameStateWithData hook replacing useAsyncData for reactive data loading
- `src/hooks/usePrestigeUpdates.ts` - Converted from polling to event-driven updates using game update subscriptions
- `src/hooks/useGameInit.ts` - Added company existence check before initialization to prevent errors
- `src/components/pages/` - All page components updated to use barrel imports and shared interfaces
- `src/components/finance/` - All finance components updated to use consolidated hooks and barrel imports
- `src/components/layout/` - Header and NotificationCenter updated to use barrel imports and reactive hooks
- `src/App.tsx` - Added game system initialization for company switching with proper error handling
- `src/lib/constants.ts` - Reorganized constants with better grouping and removed unused DEFAULT_COMPANY_ID
- `src/lib/database/customerDatabaseService.ts` - Updated to use getCurrentCompanyId() utility instead of hardcoded defaults
- **Architecture**: Complete shift to barrel export/import pattern for better code organization
- **Performance**: Eliminated redundant imports, improved reactive state management, event-driven updates
- **Code Quality**: Consistent interface usage, centralized hook management, better error handling
- **Developer Experience**: Simplified imports, shared component interfaces, consolidated loading states

---

## Version 0.0031 - 2025-09-14

### **Code Cleanup & Performance Optimization**
- `src/lib/utils/companyUtils.ts` - New utility for centralized company ID management with DEFAULT_COMPANY_ID constant
- `src/components/finance/CashFlowView.tsx` - Updated to use getCurrentCompanyId() instead of getCurrentCompany()
- `src/components/layout/Header.tsx` - Optimized company access, added useGameUpdates hook for reactive prestige updates
- `src/components/pages/CompanyOverview.tsx` - Added navigation buttons for Profile and Leaderboards
- `src/components/pages/Settings.tsx` - Added Sign Out button and improved layout
- `src/hooks/useGameInit.ts` - Removed redundant setIsLoading call
- `src/hooks/useGameState.ts` - Removed redundant initial state loading
- `src/lib/constants.ts` - Added DEFAULT_COMPANY_ID constant for consistent fallback values
- `src/lib/database/customerDatabaseService.ts` - Updated all functions to use DEFAULT_COMPANY_ID constant
- `src/lib/database/database.ts` - Updated all functions to use DEFAULT_COMPANY_ID constant
- `src/lib/database/relationshipBreakdownService.ts` - Updated to use getCurrentCompanyId() utility
- `src/lib/services/financeService.ts` - Updated to use getCurrentCompanyId() and improved transaction sorting
- `src/lib/services/sales/createCustomer.ts` - Updated to use getCurrentCompanyId() utility
- `src/lib/services/salesService.ts` - Updated to use getCurrentCompanyId() utility
- `src/lib/services/vineyardService.ts` - Updated to use getCurrentCompanyId() utility
- `src/lib/types.ts` - Removed unused formatGameDate function
- **Code Quality**: Eliminated code duplication with centralized company ID management
- **Performance**: Reduced redundant function calls and improved reactive state management
- **Consistency**: All services now use consistent company ID handling patterns

---

## Version 0.003 - 2025-09-14

### **User Login & Company Management System**
- `package.json` - Added new dependencies: @radix-ui/react-label, @radix-ui/react-select, @radix-ui/react-switch, @tailwindcss/typography, react-markdown
- `public/assets/pic/loginbg.webp` - Added login background image
- `src/App.tsx` - Complete rewrite with company selection, login flow, and navigation management
- `src/components/finance/CashFlowView.tsx` - Updated to use company-specific data loading
- `src/components/finance/FinanceView.tsx` - Added banner with background image and improved layout
- `src/components/finance/IncomeBalanceView.tsx` - Enhanced with Card components and improved data display
- `src/components/layout/Header.tsx` - Added company switching functionality and improved prestige display
- `src/components/pages/Achievements.tsx` - Complete rewrite with achievement system, progress tracking, and filtering
- `src/components/pages/AdminDashboard.tsx` - Complete rewrite with tabbed interface, database management, and cheat tools
- `src/components/pages/CompanyOverview.tsx` - New component with company stats, rankings, and navigation
- `src/components/pages/Highscores.tsx` - New global leaderboard system with company value rankings
- `src/components/pages/Login.tsx` - New login system with company creation, selection, and highscores display
- `src/components/pages/Profile.tsx` - Complete rewrite with user management, company switching, and portfolio stats
- `src/components/pages/Sales.tsx` - Updated to use company-specific data and improved formatting
- `src/components/pages/Settings.tsx` - Complete rewrite with company-specific settings and improved UI
- `src/components/pages/Winepedia.tsx` - Updated to use improved formatting utilities
- `src/components/pages/Winery.tsx` - Added banner with background image
- `src/components/ui/input.tsx` - New ShadCN input component
- `src/components/ui/label.tsx` - New ShadCN label component
- `src/components/ui/select.tsx` - New ShadCN select component
- `src/components/ui/switch.tsx` - New ShadCN switch component
- `src/hooks/useGameInit.ts` - Updated to work with new company system
- `src/hooks/useGameState.ts` - New hook for reactive game state management
- `src/hooks/usePrestigeUpdates.ts` - Updated import path
- `src/index.css` - Added wine-themed CSS variables
- `src/lib/constants.ts` - Updated game initialization constants
- `src/lib/database/customerDatabaseService.ts` - Enhanced with company-specific customer management
- `src/lib/database/database.ts` - Updated all operations to use company_id instead of player_id
- **Architecture**: Complete shift from single-player to multi-company system
- **UI/UX**: Modern login system with company selection, highscores, and improved navigation
- **Database**: All tables now use company_id for proper data isolation
- **Features**: Global leaderboards, user profiles, company switching, and enhanced admin tools

---

## Version 0.0025 - 2025-09-11

### **Sales/Customer System Code Review & Optimization**
- `src/hooks/useGameInit.ts` - Fixed to use getCurrentPrestige() instead of deprecated gameState.prestige
- `src/lib/services/sales/generateCustomer.ts` - Updated to use consistent prestige access and optimized database queries
- `src/lib/services/sales/createCustomer.ts` - Removed redundant calculateCustomerRelationshipWithBoosts function, cleaned up unused imports
- `src/lib/services/sales/generateOrder.ts` - Added customerRelationship field to order objects, fixed import paths
- `src/lib/utils/relationshipUtils.ts` - New shared utility for relationship breakdown display, consolidated duplicate UI code
- `src/components/pages/Sales.tsx` - Updated to use shared relationship utilities, fixed import paths
- `src/components/pages/Winepedia.tsx` - Updated to use shared relationship utilities, improved code consistency
- **Code Quality**: Eliminated redundant functions, consolidated duplicate relationship loading logic
- **Performance**: Optimized database queries to load only pending orders instead of all orders + filtering
- **Consistency**: All components now use getCurrentPrestige() for dynamic prestige access
- **Architecture**: Better separation of concerns with shared utilities and cleaner import structure

---

## Version 0.0024 - 2025-09-11

### **Hybrid Customer Relationship Management System**
- `src/lib/types.ts` - Added activeCustomer field to Customer interface for performance optimization
- `src/lib/database/customerDatabaseService.ts` - New service with activateCustomer() and loadActiveCustomers() functions
- `src/lib/services/sales/createCustomer.ts` - Updated to only update relationships for active customers, improved performance
- `src/lib/services/sales/generateOrder.ts` - Fixed to always calculate fresh relationships using current prestige, added customer activation
- `src/hooks/usePrestigeUpdates.ts` - Optimized to only update active customer relationships, dramatically reduced database load
- `src/lib/database/relationshipBreakdownService.ts` - Enhanced to show both stored and calculated relationship values with discrepancy notes
- **Performance**: Only updates relationships for customers who have actually placed orders (active customers)
- **Data Consistency**: Game logic now always uses fresh relationship calculations with current prestige
- **Customer Lifecycle**: Customers are automatically activated when they place their first order
- **Hybrid Approach**: Combines stored relationship values for display with fresh calculations for game logic

---

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
- **Unused Functions**: calculateSteppedBalance(), getRandomHectares(), farmlandAgePrestigeModifier(), calculateOrderAmount() - prepared for future implementation

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