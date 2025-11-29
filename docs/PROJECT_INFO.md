# Winemaker 0.4 - Project Information
## 📁 Project File Structure

```
winemaker04/
├── 📄 Configuration Files
│   ├── components.json              # ShadCN UI configuration
│   ├── package.json                 # Dependencies, pnpm scripts, Vitest config
│   ├── pnpm-lock.yaml              # pnpm dependency lock file
│   ├── pnpm-workspace.yaml         # pnpm workspace definition
│   ├── tailwind.config.js          # Tailwind CSS configuration
│   ├── tsconfig.json               # TypeScript configuration
│   ├── tsconfig.node.json          # Node.js TypeScript config
│   ├── postcss.config.js           # PostCSS configuration
│   ├── vite.config.ts              # Vite + Vitest build configuration
│   ├── vercel.json                 # Vercel deployment config
│   └── .gitignore                  # Git ignore rules
│
├── 📄 Documentation
│   ├── readme.md                   # Main project documentation
│   ├── PROJECT_INFO.md             # This file
│   └── docs/                       # Documentation directory
│       ├── AIDescriptions_coregame.md      # AI development guide
│       ├── AIpromt_codecleaning.md        # Code cleaning prompts
│       ├── AIpromt_docs.md               # Documentation prompts
│       ├── AIpromt_newpromt.md           # New prompt guidelines
│       ├── versionlog.md                 # Active version history (477 lines)
│       ├── versionlog_legacy.md          # Archived entries ≤ v0.06 (1,196 lines)
│       ├── Agents_feedback/testscripts   # Vitest prompts & runbooks
│       └── old_iterations/               # Legacy versions
│           ├── hackandslash/             # Hack and slash iteration
│           ├── simulus/                  # Simulus version
│           ├── v1/                       # JavaScript version 1
│           └── v3/                       # React/TypeScript version 3
│
├── 📄 Database & Migrations
│   └── migrations/
│       ├── sync_vercel_schema.sql                   # Full schema synchronization
│       └── vercel_migration_preserve_data_delta.sql # Incremental Vercel updates
│
├── 📄 Static Assets
│   ├── public/                     # Public static files
│   │   ├── assets/                 # Game assets
│   │   │   ├── icons/              # Activity and grape icons
│   │   │   │   ├── activities/     # 19 activity icons (.webp)
│   │   │   │   ├── characteristics/ # 6 wine characteristic icons (.png)
│   │   │   │   └── grape/          # 5 grape variety icons (.webp)
│   │   │   └── pic/                # Background images
│   │   │       └── loginbg.webp    # Login background
│   │   └── vite.svg                # Vite logo
│   │
│   ├── dist/                       # Build output directory
│   │   ├── assets/                 # Compiled assets
│   │   │   ├── icons/              # Compiled icon assets
│   │   │   ├── index-*.js          # Compiled JavaScript bundles
│   │   │   ├── index-*.css         # Compiled CSS bundles
│   │   │   └── pic/                # Compiled images
│   │   ├── index.html              # Main HTML file
│   │   └── vite.svg                # Vite logo
│   │
│   └── index.html                  # Root HTML template
│
├── 📄 Source Code (src/) - ~72,000 total lines
│   ├── main.tsx (14 lines)                    # Application entry point
│   ├── App.tsx (196 lines)                    # Main application component
│   ├── index.css (106 lines)                  # Global styles
│   ├── vite-env.d.ts (5 lines)                # Vite environment types
│   │
│   ├── components/ (≈33,000 lines total)      # React components
│   │   ├── finance/ (1,600+ lines total)     # Financial components
│   │   │   ├── CashFlowView.tsx (140 lines)   # Cash flow visualization
│   │   │   ├── FinanceView.tsx (120 lines)    # Main finance view
│   │   │   ├── IncomeBalanceView.tsx (260 lines) # Income/balance statements
│   │   │   ├── LoansView.tsx (650 lines)      # Loan management & quick loans
│   │   │   ├── ResearchPanel.tsx (240 lines)  # Research project status & unlocks
│   │   │   ├── ShareManagementPanel.tsx (700+ lines) # IPO tooling, equity breakdowns
│   │   │   ├── StaffWageSummary.tsx (130 lines) # Staff wage + experience breakdown
│   │   │   └── index.ts (5 lines)             # Barrel exports
│   │   │
│   │   ├── layout/ (1,498 lines total)        # Layout components
│   │   │   ├── ActivityPanel.tsx (347 lines)  # Activity management panel
│   │   │   ├── Header.tsx (456 lines)         # Application header
│   │   │   └── NotificationCenter.tsx (695 lines) # Notification system
│   │   │
│   │   ├── pages/ (6,704 lines total)         # Page components
│   │   │   ├── Achievements.tsx (371 lines)   # Achievement system
│   │   │   ├── AdminDashboard.tsx (455 lines) # Admin tools
│   │   │   ├── CompanyOverview.tsx (311 lines) # Company overview page
│   │   │   ├── Finance.tsx (5 lines)          # Finance page
│   │   │   ├── Highscores.tsx (450 lines)     # Leaderboard
│   │   │   ├── Login.tsx (396 lines)          # Authentication
│   │   │   ├── Profile.tsx (528 lines)        # User profile
│   │   │   ├── Sales.tsx (119 lines)          # Sales page
│   │   │   ├── Settings.tsx (327 lines)       # User settings
│   │   │   ├── Staff.tsx (843 lines)          # Staff management
│   │   │   ├── Vineyard.tsx (782 lines)       # Vineyard management
│   │   │   ├── WineLog.tsx (244 lines)        # Wine production history
│   │   │   ├── Winepedia.tsx (55 lines)       # Wine knowledge base
│   │   │   ├── Winery.tsx (279 lines)         # Winery operations
│   │   │   ├── sales/ (1,825 lines total)     # Sales sub-components
│   │   │   │   ├── OrdersTab.tsx (925 lines)  # Customer orders management
│   │   │   │   └── WineCellarTab.tsx (900 lines) # Wine inventory management
│   │   │   ├── winelog/ (661 lines total)     # Wine log sub-components
│   │   │   │   ├── ProductionHistoryTab.tsx (307 lines) # Production history
│   │   │   │   └── VineyardStatisticsTab.tsx (354 lines) # Vineyard statistics
│   │   │   └── winepedia/ (1,648 lines total) # Winepedia sub-components
│   │   │       ├── CountriesTab.tsx (51 lines) # Countries information
│   │   │       ├── CrossTraitPenaltyTab.tsx (70 lines) # Cross-trait penalties
│   │   │       ├── CustomersTab.tsx (233 lines) # Customer information
│   │   │       ├── CustomerTypesTab.tsx (45 lines) # Customer types
│   │   │       ├── DynamicRangeTab.tsx (154 lines) # Dynamic ranges
│   │   │       ├── GrapeInfoView.tsx (141 lines) # Grape information
│   │   │       ├── GrapeVarietiesTab.tsx (42 lines) # Grape varieties
│   │   │       ├── index.ts (11 lines)        # Barrel exports
│   │   │       ├── MathematicalModelsTab.tsx (621 lines) # Mathematical models
│   │   │       ├── WinemakingTab.tsx (15 lines) # Winemaking information
│   │   │       ├── WineQualityTab.tsx (77 lines) # Wine quality
│   │   │       ├── WineRegionsTab.tsx (15 lines) # Wine regions
│   │   │       └── YieldProjectionTab.tsx (387 lines) # Yield projections
│   │   │
│   │   └── ui/ (13,959 lines total)           # UI components
│   │       ├── activities/ (551 lines total)  # Activity components
│   │       │   ├── ActivityCard.tsx (195 lines) # Activity card component
│   │       │   ├── activityOptionsModal.tsx (298 lines) # Activity options modal
│   │       │   └── workCalculationTable.tsx (58 lines) # Work calculation table
│   │       ├── components/ (2,500+ lines total) # Generic components
│   │       │   ├── BalanceScoreBreakdown.tsx (735 lines) # Balance score breakdown
│   │       │   ├── characteristicBar.tsx (270 lines) # Characteristic bar
│   │       │   ├── CharacteristicSlider.tsx (76 lines) # Characteristic slider
│   │       │   ├── FeatureDisplay.tsx (608 lines) # Unified wine feature display
│   │       │   ├── grapeQualityBar.tsx (305 lines) # Grape quality bar
│   │       │   ├── grapeQualityBreakdown.tsx (504 lines) # Grape quality breakdown
│   │       │   └── StaffSkillBar.tsx (89 lines) # Staff skill bar
│   │       ├── modals/ (6,602 lines total)    # Modal dialogs
│   │       │   ├── UImodals/ (1,500+ lines total) # UI modals
│   │       │   │   ├── index.ts (8 lines)     # Barrel exports
│   │       │   │   ├── LoanApplicationModal.tsx (243 lines) # Loan application modal
│   │       │   │   ├── prestigeModal.tsx (606 lines) # Prestige modal
│   │       │   │   ├── StaffModal.tsx (176 lines) # Staff modal
│   │       │   │   ├── vineyardModal.tsx (421 lines) # Vineyard modal
│   │       │   │   ├── WarningModal.tsx (141 lines) # Warning modal
│   │       │   │   └── wineModal.tsx (462 lines) # Wine modal
│   │       │   ├── activitymodals/ (5,000+ lines total) # Activity modals
│   │       │   │   ├── ClearingOptionsModal.tsx (532 lines) # Clearing options
│   │       │   │   ├── CrushingOptionsModal.tsx (484 lines) # Crushing options
│   │       │   │   ├── FermentationOptionsModal.tsx (401 lines) # Fermentation options
│   │       │   │   ├── HarvestOptionsModal.tsx (177 lines) # Harvest options
│   │       │   │   ├── HireStaffModal.tsx (262 lines) # Hire staff modal
│   │       │   │   ├── LandSearchOptionsModal.tsx (423 lines) # Land search options
│   │       │   │   ├── LandSearchResultsModal.tsx (314 lines) # Land search results
│   │       │   │   ├── LenderSearchOptionsModal.tsx (255 lines) # Lender search options
│   │       │   │   ├── LenderSearchResultsModal.tsx (324 lines) # Lender search results
│   │       │   │   ├── PlantingOptionsModal.tsx (147 lines) # Planting options
│   │       │   │   ├── StaffAssignmentModal.tsx (313 lines) # Staff assignment
│   │       │   │   ├── StaffSearchOptionsModal.tsx (269 lines) # Staff search options
│   │       │   │   └── StaffSearchResultsModal.tsx (261 lines) # Staff search results
│   │       │   └── winebreakdownmodals/ (96 lines total) # Wine analysis modals
│   │       │       ├── BalanceBreakdownModal.tsx (49 lines) # Balance breakdown
│   │       │       └── QualityBreakdownModal.tsx (47 lines) # Quality breakdown
│   │       ├── shadCN/ (2,442 lines total)    # ShadCN UI components
│   │       │   ├── accordion.tsx (49 lines)   # Accordion component
│   │       │   ├── avatar.tsx (43 lines)      # Avatar component
│   │       │   ├── badge.tsx (31 lines)       # Badge component
│   │       │   ├── button.tsx (52 lines)      # Button component
│   │       │   ├── card.tsx (172 lines)       # Card component
│   │       │   ├── dialog.tsx (108 lines)     # Dialog component
│   │       │   ├── dropdown-menu.tsx (181 lines) # Dropdown menu
│   │       │   ├── input.tsx (21 lines)       # Input component
│   │       │   ├── label.tsx (20 lines)       # Label component
│   │       │   ├── navigation-menu.tsx (117 lines) # Navigation menu
│   │       │   ├── progress.tsx (24 lines)    # Progress component
│   │       │   ├── scroll-area.tsx (42 lines) # Scroll area
│   │       │   ├── select.tsx (145 lines)     # Select component
│   │       │   ├── separator.tsx (26 lines)   # Separator component
│   │       │   ├── sheet.tsx (125 lines)      # Sheet component
│   │       │   ├── sidebar.tsx (718 lines)    # Sidebar component
│   │       │   ├── skeleton.tsx (13 lines)    # Skeleton component
│   │       │   ├── slider.tsx (23 lines)      # Slider component
│   │       │   ├── switch.tsx (24 lines)      # Switch component
│   │       │   ├── table.tsx (129 lines)      # Table component
│   │       │   ├── tabs.tsx (47 lines)        # Tabs component
│   │       │   ├── toast.tsx (115 lines)      # Toast component
│   │       │   ├── toaster.tsx (98 lines)     # Toaster component
│   │       │   └── tooltip.tsx (24 lines)     # Tooltip component
│   │       ├── vineyard/ (333 lines total)    # Vineyard-specific components
│   │       │   ├── HarvestFeatureRisksDisplay.tsx (267 lines) # Harvest feature risks
│   │       │   └── HealthTooltip.tsx (66 lines) # Health tooltip
│   │       ├── wine/ (1,180 lines total)      # Wine-specific components
│   │       │   ├── FeatureBadge.tsx (115 lines) # Feature badge
│   │       │   ├── WineryEvolvingFeaturesDisplay.tsx (302 lines) # Evolving features
│   │       │   ├── WineryFeatureRiskDisplay.tsx (93 lines) # Feature risk display
│   │       │   └── WineryFeatureStatusGrid.tsx (570 lines) # Feature status grid
│   │       └── index.ts (42 lines)            # Barrel exports
│   │
│   ├── hooks/ (900+ lines total)              # Custom React hooks
│   │   ├── index.ts (10 lines)                # Hook exports
│   │   ├── use-mobile.tsx (15 lines)          # Mobile detection hook
│   │   ├── useCustomerData.ts (66 lines)      # Customer data hook
│   │   ├── useCustomerRelationshipUpdates.ts (63 lines) # Customer relationship updates
│   │   ├── useGameState.ts (74 lines)         # Game state management
│   │   ├── useGameUpdates.ts (39 lines)       # Game updates hook
│   │   ├── useLoadingState.ts (30 lines)      # Loading state management
│   │   ├── usePrestigeUpdates.ts (104 lines)  # Prestige updates hook
│   │   ├── useTableSort.ts (166 lines)        # Table sorting functionality
│   │   ├── useWineBalance.ts (49 lines)       # Wine balance calculations
│   │   ├── useWineCombinedScore.ts (64 lines) # Combined wine scoring
│   │   └── useWineFeatureDetails.ts (79 lines) # Wine feature details
│   │
│   └── lib/ (28,000+ lines total)             # Core library code
│       ├── balance/ (690 lines total)         # Wine balance system
│       │   ├── calculations/ (318 lines total) # Balance calculations
│       │   │   ├── balanceCalculator.ts (122 lines) # Balance calculator
│       │   │   ├── rangeCalculator.ts (61 lines) # Range calculator
│       │   │   └── ruleCalculator.ts (135 lines) # Rule calculator
│       │   ├── config/ (439 lines total)      # Balance configuration
│       │   │   ├── rangeAdjustments.ts (174 lines) # Range adjustments
│       │   │   └── rules.ts (265 lines)       # Balance rules
│       │   ├── types/ (68 lines total)        # Balance types
│       │   │   ├── balanceCalculationsTypes.ts (29 lines) # Calculation types
│       │   │   └── balanceRulesTypes.ts (39 lines) # Rule types
│       │   └── index.ts (8 lines)             # Barrel exports
│       │
│       ├── constants/ (2,000+ lines total)     # Game constants and configuration
│       │   ├── achievementConstants.ts (540 lines) # Achievement definitions
│       │   ├── activityConstants.ts (220 lines) # Activity system constants
│       │   ├── activityConstants.dev.ts (10 lines) # Development activity constants
│       │   ├── constants.ts (135 lines)       # Core game constants
│       │   ├── constants.dev.ts (23 lines)    # Development constants
│       │   ├── economyConstants.ts (159 lines) # Economy phase and credit rating constants
│       │   ├── financeConstants.ts (80 lines) # Financial constants
│       │   ├── grapeConstants.ts (109 lines)  # Grape variety constants
│       │   ├── loanConstants.ts (188 lines)   # Loan system constants
│       │   ├── namesConstants.ts (242 lines)  # Name generation constants
│       │   ├── staffConstants.ts (97 lines)   # Staff system constants
│       │   ├── vineyardConstants.ts (321 lines) # Vineyard constants
│       │   ├── wineFeatures/ (1,005 lines total) # Wine feature configurations
│       │   │   ├── bottleAging.ts (138 lines) # Bottle aging features
│       │   │   ├── commonFeaturesUtil.ts (9 lines) # Common wine feature utilities
│       │   │   ├── greenFlavor.ts (187 lines) # Green flavor features
│       │   │   ├── index.ts (66 lines)        # Wine features exports
│       │   │   ├── lateHarvest.ts (132 lines) # Late harvest features
│       │   │   ├── oxidation.ts (197 lines)   # Oxidation features
│       │   │   ├── stuckFermentation.ts (168 lines) # Stuck fermentation features
│       │   │   └── terroir.ts (117 lines)     # Terroir features
│       │   └── index.ts (9 lines)             # Constants barrel exports
│       │
│       ├── database/ (1,540 lines total)      # Database layer
│       │   ├── activities/ (448 lines total)  # Activity database operations
│       │   │   ├── activityDB.ts (173 lines)  # Activity database operations
│       │   │   ├── inventoryDB.ts (201 lines) # Inventory database operations
│       │   │   └── vineyardDB.ts (74 lines)   # Vineyard database operations
│       │   ├── core/ (1,600+ lines total)      # Core database operations
│       │   │   ├── achievementsDB.ts (228 lines) # Achievements database
│       │   │   ├── companiesDB.ts (186 lines) # Companies database
│       │   │   ├── companySharesDB.ts (208 lines) # Company shares database (normalized)
│       │   │   ├── companyMetricsHistoryDB.ts (319 lines) # Company metrics history snapshots
│       │   │   ├── gamestateDB.ts (53 lines)  # Game state database
│       │   │   ├── highscoresDB.ts (174 lines) # Highscores database
│       │   │   ├── lendersDB.ts (126 lines)   # Lenders database
│       │   │   ├── loansDB.ts (171 lines)     # Loans database
│       │   │   ├── notificationsDB.ts (151 lines) # Notifications database
│       │   │   ├── staffDB.ts (165 lines)     # Staff database
│       │   │   ├── researchUnlocksDB.ts (154 lines) # Research unlock persistence
│       │   │   ├── supabase.ts (7 lines)      # Supabase configuration
│       │   │   ├── teamDB.ts (159 lines)      # Teams database
│       │   │   ├── transactionsDB.ts (71 lines) # Transactions database
│       │   │   ├── usersDB.ts (98 lines)      # Users database
│       │   │   ├── userSettingsDB.ts (95 lines) # User settings database
│       │   │   └── wineLogDB.ts (101 lines)   # Wine log database
│       │   ├── customers/ (388 lines total)   # Customer database operations
│       │   │   ├── customerDB.ts (220 lines)  # Customer database
│       │   │   ├── prestigeEventsDB.ts (98 lines) # Prestige events database
│       │   │   ├── relationshipBoostsDB.ts (65 lines) # Relationship boosts
│       │   │   └── salesDB.ts (109 lines)     # Sales database
│       │   └── index.ts (15 lines)            # Database barrel exports
│       │
│       ├── services/ (8,500+ lines total)     # Business logic services
│       │   ├── activity/ (2,200+ lines total) # Activity services
│       │   │   ├── activitymanagers/ (1,400+ lines total) # Activity managers
│       │   │   │   ├── activityManager.ts (435 lines) # Main activity manager
│       │   │   │   ├── bookkeepingManager.ts (114 lines) # Bookkeeping manager
│       │   │   │   ├── landSearchManager.ts (267 lines) # Land search manager
│       │   │   │   ├── lenderSearchManager.ts (207 lines) # Lender search manager
│       │   │   │   ├── staffSearchManager.ts (267 lines) # Staff search manager
│       │   │   │   └── takeLoanManager.ts (73 lines) # Take loan manager
│       │   │   ├── workcalculators/ (1,200+ lines total) # Work calculators
│       │   │   │   ├── bookkeepingWorkCalculator.ts (187 lines) # Bookkeeping work
│       │   │   │   ├── clearingWorkCalculator.ts (288 lines) # Clearing work calculator
│       │   │   │   ├── crushingWorkCalculator.ts (187 lines) # Crushing work
│       │   │   │   ├── fermentationWorkCalculator.ts (154 lines) # Fermentation work
│       │   │   │   ├── harvestingWorkCalculator.ts (154 lines) # Harvesting work calculator
│       │   │   │   ├── landSearchWorkCalculator.ts (154 lines) # Land search work calculator
│       │   │   │   ├── lenderSearchWorkCalculator.ts (97 lines) # Lender search work calculator
│       │   │   │   ├── overgrowthUtils.ts (44 lines) # Overgrowth utility functions
│       │   │   │   ├── plantingWorkCalculator.ts (154 lines) # Planting work calculator
│       │   │   │   ├── staffSearchWorkCalculator.ts (208 lines) # Staff search work
│       │   │   │   ├── takeLoanWorkCalculator.ts (44 lines) # Take loan work calculator
│       │   │   │   ├── vineyardWorkCalculator.ts (164 lines) # Vineyard work
│       │   │   │   └── workCalculator.ts (153 lines) # General work calculator
│       │   │   └── index.ts (29 lines)        # Activity services exports
│       │   ├── core/ (1,200+ lines total)    # Core services
│       │   │   ├── gameState.ts (277 lines)   # Game state management
│       │   │   ├── gameTick.ts (269 lines)    # Game tick system
│       │   │   ├── notificationService.ts (242 lines) # Centralized notification service
│       │   │   └── index.ts (116 lines)       # Core services exports
│       │   ├── finance/ (2,400+ lines total) # Finance services
│       │   │   ├── creditRatingService.ts (438 lines) # Credit rating calculation
│       │   │   ├── economyService.ts (90 lines) # Economy phase transitions
│       │   │   ├── financeService.ts (350 lines) # Finance operations
│       │   │   ├── lenderService.ts (220 lines) # Lender generation
│       │   │   ├── loanService.ts (900+ lines) # Loan management
│       │   │   ├── wageService.ts (260 lines) # Wage calculations & staff XP
│       │   │   └── shares/ (2,240+ lines total) # Share system (modular architecture)
│       │   │       ├── sharePriceService.ts (657 lines) # Core share price calculation & adjustment
│       │   │       ├── shareOperationsService.ts (544 lines) # Share issuance, buyback, dividends
│       │   │       ├── shareMetricsService.ts (446 lines) # Share metrics & shareholder breakdown
│       │   │       ├── growthTrendService.ts (233 lines) # Growth trend analysis
│       │   │       ├── sharePriceBreakdownHelpers.ts (149 lines) # Price breakdown formatters
│       │   │       ├── shareCalculations.ts (125 lines) # Core calculation utilities
│       │   │       └── sharePriceAdjustmentHelpers.ts (127 lines) # Price adjustment helpers
│       │   ├── prestige/ (1,180 lines total)  # Prestige system services
│       │   │   ├── prestigeCalculator.ts (188 lines) # Prestige calculator
│       │   │   ├── prestigeDecayService.ts (57 lines) # Prestige decay
│       │   │   ├── prestigeService.ts (935 lines) # Main prestige service
│       │   │   └── index.ts (116 lines)       # Prestige services exports
│       │   ├── sales/ (1,215 lines total)     # Sales services
│       │   │   ├── createCustomer.ts (336 lines) # Customer creation
│       │   │   ├── generateCustomer.ts (95 lines) # Customer generation
│       │   │   ├── generateOrder.ts (245 lines) # Order generation
│       │   │   ├── relationshipService.ts (139 lines) # Relationship management
│       │   │   ├── salesOrderService.ts (153 lines) # Sales order service
│       │   │   └── salesService.ts (147 lines) # Main sales service
│       │   ├── user/ (3,372 lines total)      # User services
│       │   │   ├── achievementService.ts (772 lines) # Achievement system
│       │   │   ├── authService.ts (182 lines) # Authentication service
│       │   │   ├── companyService.ts (137 lines) # Company management
│       │   │   ├── financeService.ts (282 lines) # Finance service
│       │   │   ├── highscoreService.ts (302 lines) # Highscore service
│       │   │   ├── staffSearchManager.ts (436 lines) # Staff search manager
│       │   │   ├── staffService.ts (224 lines) # Staff management
│       │   │   ├── teamService.ts (365 lines) # Team management
│       │   │   ├── userSettingsService.ts (195 lines) # User settings
│       │   │   ├── wageService.ts (232 lines) # Wage calculation
│       │   │   ├── wineLogService.ts (355 lines) # Wine log service
│       │   │   └── index.ts (116 lines)       # User services exports
│       │   ├── vineyard/ (1,664 lines total)  # Vineyard services
│       │   │   ├── clearingManager.ts (208 lines) # Clearing management
│       │   │   ├── clearingService.ts (175 lines) # Clearing service
│       │   │   ├── landSearchService.ts (467 lines) # Land search service
│       │   │   ├── vineyardManager.ts (365 lines) # Vineyard management
│       │   │   ├── vineyardService.ts (229 lines) # Main vineyard service
│       │   │   ├── vineyardValueCalc.ts (103 lines) # Vineyard value calculation
│       │   │   └── vinyardBuyingService.ts (167 lines) # Vineyard buying
│       │   ├── wine/ (1,781 lines total)      # Wine services
│       │   │   ├── characteristics/ (510 lines total) # Wine characteristics
│       │   │   │   ├── crushingCharacteristics.ts (245 lines) # Crushing characteristics
│       │   │   │   ├── defaultCharacteristics.ts (18 lines) # Default characteristics
│       │   │   │   ├── fermentationCharacteristics.ts (161 lines) # Fermentation characteristics
│       │   │   │   └── harvestCharacteristics.ts (86 lines) # Harvest characteristics
│       │   │   ├── features/ (1,500+ lines total) # Wine features
│       │   │   │   ├── agingService.ts (171 lines) # Aging service
│       │   │   │   ├── featureRiskService.ts (605 lines) # Feature risk calculation
│       │   │   │   └── featureService.ts (1,559 lines) # Unified feature service
│       │   │   ├── winery/ (500 lines total)  # Winery operations
│       │   │   │   ├── crushingManager.ts (72 lines) # Crushing management
│       │   │   │   ├── fermentationManager.ts (180 lines) # Fermentation management
│       │   │   │   ├── inventoryService.ts (236 lines) # Inventory service
│       │   │   │   └── wineryService.ts (48 lines) # Main winery service
│       │   │   ├── winescore/ (155 lines total) # Wine scoring
│       │   │   │   ├── wineQualityCalculationService.ts (129 lines) # Quality calculation
│       │   │   │   └── wineScoreCalculation.ts (26 lines) # Score calculation
│       │   │   └── index.ts (116 lines)       # Wine services exports
│       │   └── index.ts (116 lines)           # Services barrel exports
│       │
│       ├── types/ (865 lines total)           # TypeScript type definitions
│       │   ├── types.ts (588 lines)           # Core game types
│       │   ├── UItypes.ts (64 lines)          # UI component types
│       │   └── wineFeatures.ts (213 lines)    # Wine feature types
│       │
│       └── utils/ (1,471 lines total)         # Utility functions
│           ├── calculator.ts (477 lines)      # Mathematical calculations
│           ├── colorMapping.ts (184 lines)    # Color mapping utilities
│           ├── companyUtils.ts (30 lines)     # Company utility functions
│           ├── icons.tsx (107 lines)          # Icon utilities
│           ├── index.ts (13 lines)            # Utils barrel exports
│           ├── toast.ts (171 lines)           # Toast notification utilities
│           └── utils.ts (519 lines)           # General utilities
│
├── tests/                          # Vitest suites (activity/finance/user/vineyard/wine)
├── test-viewer/                    # Standalone test dashboard (HTML/TS + script)
├── server/                         # Dev-only test API helper
└── node_modules/                   # Dependencies (not tracked in git)
```
## 📊 Code Statistics

### Line Count Summary (src/ directory only)
- **Total Files**: 266 files (TS/TSX/CSS)
- **Total Lines of Code**: ~72,000 lines

### Breakdown by File Type
- **TypeScript Files** (.ts, .tsx): 265 files | ~71,866 lines
- **CSS Files** (.css): 1 file | 134 lines  

---

**Last Updated**: 2025-11-29  

