# Staff Wage System Integration with Finance

## Overview
Successfully integrated the staff wage system with the existing finance/transaction system. Staff wages are now automatically deducted and tracked in the financial records.

**Wage System:** Weekly wages paid out seasonally (every 12 weeks) to match the game's date system.

## Implementation Details

### 1. Transaction Categories (`financeConstants.ts`)
Added standardized transaction categories including:
- `STAFF_WAGES` - For employee wage payments
- `WINE_SALES`, `GRAPE_SALES` - Income categories
- Other expense categories (Equipment, Buildings, Maintenance, etc.)

### 2. Wage Payment System (`staffService.ts`)
**New Functions:**
- `processSeasonalWages()` - Automatically processes seasonal wage payments for all staff
  - Calculates total wages for all employees (weekly wage × 12 weeks)
  - Checks if company has sufficient funds (shows warning if not)
  - Creates transaction record via `addTransaction()`
  - Deducts money from company balance

- `getTotalWeeklyWages()` - Returns total weekly wage expense
- `getTotalSeasonalWages()` - Returns total seasonal wage expense (12 weeks)
- `getTotalYearlyWages()` - Returns total yearly wage expense (4 seasons)

**Wage Calculation:**
- Weekly wages are calculated per staff member based on:
  - Base weekly wage: €500
  - Skill multiplier: €1000 per average skill point
  - Specialization bonus: 30% multiplicative per specialization
  - Formula: `(BASE_WAGE + (avgSkill * SKILL_MULTIPLIER)) * specializationBonus`

### 3. Game Tick Integration (`gameTick.ts`)
Wage payments are processed automatically every season:
- Payment timing: Week 1 of each season (Spring, Summer, Fall, Winter)
- This creates 4 payments per year (one per season)
- Each payment covers 12 weeks of wages
- Integrated into `processWeeklyEffects()` function

### 4. Finance UI (`StaffWageSummary.tsx`)
New component displays:
- Total staff count
- Weekly, seasonal, and yearly wage expenses
- Payment schedule information
- Individual staff member wages (weekly and per season)
- Displayed in Finance > Income/Balance tab

### 5. Updated Finance Service (`financeService.ts`)
- Now uses `TRANSACTION_CATEGORIES` constants
- Updated starting capital initialization to use constant

## Payment Flow

1. **Game Tick** (every week)
   - `processGameTick()` is called
   - Checks if current week is 1
   
2. **Seasonal Wage Payment** (Week 1 of each season)
   - `processSeasonalWages()` executes
   - Calculates total wages: weekly wage × 12 weeks × number of staff
   - Checks company balance
   
3. **Transaction Creation**
   - `addTransaction()` creates expense record
   - Amount: Negative total seasonal wages
   - Category: "Staff Wages"
   - Description: "{Season} wages for X staff members"
   - Recurring: true
   
4. **State Update**
   - Company money is updated
   - Transaction is saved to database
   - UI automatically refreshes via hooks

## Database Integration

Transactions are stored in the `transactions` table with:
- `company_id` - Links to company
- `amount` - Negative for wages (expense)
- `description` - Details about payment
- `category` - "Staff Wages"
- `recurring` - true (indicates regular payment)
- `week`, `season`, `year` - When payment occurred
- `money` - Company balance after transaction

## UI Integration

### Finance View
Shows wage information in two places:

1. **Income Statement** (IncomeBalanceView)
   - Staff wages appear in expense breakdown
   - Automatically calculated from transactions

2. **Staff Wage Summary** (StaffWageSummary)
   - Dedicated card showing:
     - Current staff count
     - Weekly/seasonal/yearly costs
     - Payment schedule (seasonal payments)
     - Individual staff wages (per week and per season)

### Cash Flow View
All wage transactions appear in chronological order with:
- Transaction date
- Description
- Amount
- Running balance

## Testing Checklist

- [x] Wage calculation formulas work correctly
- [x] Automatic payment triggers at correct weeks
- [x] Transactions are created and saved to database
- [x] Company money is deducted properly
- [x] UI displays wage information correctly
- [x] Warning shows when insufficient funds


## Game Date System Alignment

The wage system is designed to align perfectly with the game's date system:
- **Game Date Units:** Weeks (1-12) → Seasons (4) → Years
- **Wage Base Unit:** Weekly (€/week)
- **Payment Frequency:** Seasonal (every 12 weeks)
- **Payment Timing:** Week 1 of Spring, Summer, Fall, Winter

This creates a natural rhythm:
- 4 seasonal payments per year
- Each payment covers 12 weeks of work
- Predictable cash flow aligned with game progression

## Future Enhancements

1. **Payment Flexibility**
   - Allow custom payment schedules (weekly vs seasonal)
   - Bonus payments at year-end
   
2. **Wage Adjustments**
   - Raise/bonus system
   - Performance-based bonuses
   - Skill improvement wage increases
   
3. **Financial Reports**
   - Wage expense trends per season
   - Cost per activity analysis
   - Staff ROI calculations
   
4. **Notifications**
   - Upcoming seasonal wage payment reminders
   - Cash flow warnings before payment week
   - Annual wage summaries

## Files Modified

1. `src/lib/constants/financeConstants.ts` - Added transaction categories
2. `src/lib/services/user/staffService.ts` - Added wage payment logic
3. `src/lib/services/user/financeService.ts` - Updated to use constants
4. `src/lib/services/core/gameTick.ts` - Added monthly wage processing
5. `src/lib/services/index.ts` - Exported new functions
6. `src/components/finance/StaffWageSummary.tsx` - New UI component
7. `src/components/finance/FinanceView.tsx` - Added wage summary display
8. `src/components/finance/index.ts` - Exported new component
9. `src/components/ui/shadCN/card.tsx` - Fixed SimpleCardProps interface

## Notes

- Wages are stored and displayed as weekly amounts (€/week)
- Payments are processed seasonally (12 weeks × weekly wage)
- System gracefully handles insufficient funds (shows warning, still processes)
- All wage data updates reactively via existing hook system
- Compatible with multi-company architecture (company-scoped transactions)
- Perfectly aligned with game's week/season/year date system

