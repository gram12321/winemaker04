<!-- 61552660-7b1f-4bec-9806-49b1b5e4667f be31404a-f0ad-4ef4-a0d9-36007f209789 -->
# Share Price Valuation System Redesign

## Overview

Transform share price from simple `book_value × economy_multiplier` to a comprehensive incremental adjustment system that compares actual performance against expected benchmarks. Credit rating is one input among several, with careful separation to avoid double-counting.

## Implementation Status: ✅ COMPLETE

The system has been fully implemented using an **incremental adjustment model** rather than the originally planned multiplier-based deterministic calculation. This provides more realistic, gradual price movements.

## Key Design Decisions

### 1. Credit Rating Component Analysis ✅

**Keep in Credit Rating Only:**
- Asset health metrics (debt-to-asset, liquidity) - these are risk-focused
- Payment history - purely creditworthiness
- Negative balance penalties - risk signal

**Move/Share Components:**
- Profit consistency → Use profit margin + growth trends instead for share price
- Expense efficiency → Use profit margin instead (revenue/expense ratio)
- Company age → Can be used in both (stability signal)

**Result:** Credit rating remains risk-focused; share price focuses on performance/value.

### 2. Share Price System: Incremental Adjustment Model ✅

**Final Implementation:**
- **Initial Price**: Book Value per Share (simple, deterministic)
- **Weekly Adjustments**: Incremental delta-based system
- **Anchor Constraint**: Book value acts as anchor, making extreme prices harder to achieve

#### Metrics Included (All Implemented ✅)

**Profitability Metrics:**
- Revenue per Share ✅
- Earnings per Share ✅
- Revenue Growth ✅
- Profit Margin ✅

**Financial Stability:**
- Book Value per Share (as anchor) ✅
- Fixed Asset Ratio (trend-based) ✅
- Credit Rating (trend-based) ✅

**Operations Quality:**
- Company Prestige (trend-based) ✅

**Market Factors:**
- Economy Phase (affects expected values) ✅
- Dividend per Share ✅

### 3. Expected Value System ✅

**Fully Implemented:**
- Economy phase baseline factors ✅
- Prestige scaling using `NormalizeScrewed1000To01WithTail` ✅
- Growth trend tracker (persisted in database) ✅
- Dynamic adjustment formula: `baseExpectation × economyFactor × prestigeFactor × growthTrendFactor` ✅

### 4. Comparison Model ✅

**Implementation:**
- For expected-based metrics: Compare actual vs. expected value
- For trend-based metrics: Compare current vs. previous value
- Percentage delta calculation: `(Actual - Expected) / Expected × 100`
- Euro contribution: `Delta_Ratio × Base_Adjustment` (with individual caps)
- Anchor factor application to constrain movements

### 5. Incremental Adjustment Formula ✅

```
Initial Price = Book Value per Share

Weekly Adjustment:
1. Calculate delta for each metric (percentage difference)
2. Convert each delta to euro contribution (clamped to maxRatio)
3. Sum all contributions
4. Apply anchor factor: adjustment = totalContribution × anchorFactor
5. Update price: newPrice = currentPrice + adjustment
6. Apply soft floor: minPrice = bookValue × 0.10
```

**Anchor Factor Formula:**
```
anchorFactor = 1 / (1 + strength × deviation^exponent)
deviation = |currentPrice - bookValue| / bookValue
```

## Implementation Tasks

### Phase 1: Foundation ✅

1. **Create share valuation service** (`src/lib/services/finance/shareValuationService.ts`)
   - ✅ Main calculation functions
   - ✅ Expected value calculation helpers
   - ✅ Simplified to initial price calculation (book value)

2. **Add missing metrics**
   - ✅ Profit margin calculation (netIncome / revenue)
   - ✅ Revenue growth calculation (YOY percentage)
   - ✅ Fixed asset ratio (fixedAssets / totalAssets)
   - ✅ Historical revenue tracking for growth calculations

3. **Expected value calculation module**
   - ✅ Economy phase baseline factors
   - ✅ Prestige scaling function using `NormalizeScrewed1000To01WithTail`
   - ✅ Growth trend tracker (persisted via companyDB)
   - ✅ Service: `growthTrendService.ts`

### Phase 2: Credit Rating Separation ✅

1. **Audit credit rating components**
   - ✅ Documented separation (in service comments)
   - ✅ Credit rating used only as trend-based metric in share price

2. **Update credit rating service** (if needed)
   - ✅ No changes needed - credit rating already separated

### Phase 3: Integration ✅

1. **Share price calculation**
   - ✅ Initial price: Book value per share
   - ✅ Incremental system: `sharePriceIncrementService.ts`
   - ✅ Weekly updates via `gameTick.ts`

2. **Market cap calculation**
   - ✅ Updated to use current share price from database
   - ✅ Formula: `marketCap = sharePrice × totalShares`

3. **Share metrics**
   - ✅ Added profit margin to `ShareMetrics` interface
   - ✅ Added revenue growth to `ShareMetrics`
   - ✅ All metrics calculated in `getShareMetrics()`

### Phase 4: Testing & Tuning ✅

1. **Test edge cases**
   - ✅ New companies (no history) - handled with defaults
   - ✅ Negative earnings - handled with fallbacks
   - ✅ Zero revenue periods - handled with expected value comparisons
   - ✅ High prestige, low performance - tested via incremental adjustments

2. **Balance adjustments**
   - ✅ Individual metric caps prevent extreme swings
   - ✅ Anchor factor constrains movements naturally
   - ✅ Soft floor prevents price collapse
   - ✅ System tested with various economy phases

### Phase 5: Incremental System Refinement ✅

1. **Delta-based calculations**
   - ✅ Per-metric euro contributions instead of percentage summation
   - ✅ Individual delta caps per metric
   - ✅ Dynamic soft floor based on book value

2. **Anchor constraint**
   - ✅ Natural constraint without hard bounds
   - ✅ Adjustments become smaller as price moves from anchor

3. **Removed multiplier system**
   - ✅ All multiplier-based calculations removed
   - ✅ Simplified initial price to book value only
   - ✅ All metrics now part of incremental system

## Files Created/Modified

### New Files ✅

- ✅ `src/lib/services/finance/shareValuationService.ts` - Expected values and initial price
- ✅ `src/lib/services/finance/sharePriceIncrementService.ts` - Incremental adjustment logic
- ✅ `src/lib/services/finance/growthTrendService.ts` - Growth trend tracking
- ✅ `src/lib/constants/shareValuationConstants.ts` - Constants for incremental system

### Modified Files ✅

- ✅ `src/lib/services/finance/shareManagementService.ts` - Added profit margin, revenue growth to metrics
- ✅ `src/lib/services/core/gameTick.ts` - Weekly share price adjustments
- ✅ `src/lib/database/core/companiesDB.ts` - Added growth trend and previous value tracking fields
- ✅ `src/components/finance/ShareManagementPanel.tsx` - UI updates for incremental system
- ✅ `src/components/pages/AdminDashboard.tsx` - Debug output for incremental system
- ✅ `src/components/pages/winepedia/ShareMarketTab.tsx` - Documentation of incremental system

## Constants Implemented

✅ **EXPECTED_VALUE_BASELINES**
- revenueGrowth: 0.10 (10% per year)
- profitMargin: 0.15 (15%)

✅ **INCREMENTAL_METRIC_CONFIG**
- Base adjustments for 8 metrics (revenue/share, EPS, dividend, revenue growth, profit margin, credit rating, fixed asset ratio, prestige)
- Individual maxRatio caps per metric

✅ **INCREMENTAL_ANCHOR_CONFIG**
- strength: 2.0
- exponent: 1.25
- minPriceRatioToAnchor: 0.1 (soft floor)

✅ **PRESTIGE_SCALING**
- base: 1.0
- maxMultiplier: 2.0

✅ **GROWTH_TREND_CONFIG**
- adjustmentIncrement: 0.02
- maxAdjustment: 0.5
- minAdjustment: 0.5

## Resolved Decisions

1. ✅ **Expected value scaling:** Using `NormalizeScrewed1000To01WithTail` from `calculator.ts` for logarithmic prestige scaling
2. ✅ **Growth trend mechanism:** Persisted via companyDB with annual updates
3. ✅ **Profit margin baseline:** Varies by economy phase (via expected value calculation)
4. ✅ **Backward compatibility:** No migration needed - server/users/db will be reset
5. ✅ **Incremental vs. Deterministic:** Final decision: Incremental adjustment system with book value as initial price and anchor
6. ✅ **Multiplier system:** Removed entirely - all metrics now part of incremental delta system

## Current System Architecture

### Initial Share Price
```
Initial Price = Book Value per Share
```

### Weekly Adjustment Process
```
For each metric:
  - Calculate delta (actual vs. expected/previous)
  - Convert to euro contribution (clamped)
  - Sum all contributions
  - Apply anchor factor
  - Update price: newPrice = currentPrice + adjustment
```

### Key Features
- ✅ 8 metrics contributing to adjustments
- ✅ Expected values adjust based on economy, prestige, growth trends
- ✅ Anchor constraint prevents extreme prices
- ✅ Soft floor at 10% of book value
- ✅ Weekly updates via game tick
- ✅ All calculations visible in debug panel

## Documentation

- ✅ `docs/share_price_multipliers_explanation.md` - Complete system documentation (renamed/updated to cover entire system)
- ✅ `src/components/pages/winepedia/ShareMarketTab.tsx` - User-facing explanation
- ✅ Inline code comments explaining calculations

## Testing Status

- ✅ Unit tests for growth trend service
- ✅ Integration with game tick system
- ✅ UI displays all metrics and adjustments
- ✅ Debug panel shows complete calculation breakdown

## Phase 6: Historical Snapshot System ✅

1. **Created `company_metrics_history` table**
   - ✅ Stores weekly snapshots of credit rating, prestige, fixed asset ratio
   - ✅ Used for 48-week rolling comparisons
   - ✅ Enables efficient historical trend queries

2. **Unified 48-week comparison system**
   - ✅ All metrics now use 48-week rolling windows for consistent comparisons
   - ✅ Trend-based metrics (credit rating, fixed asset ratio, prestige) compare current vs. 48 weeks ago
   - ✅ Expected-based metrics compare last 48 weeks vs. expected annual values

3. **Benefits of snapshot system**
   - No need to recalculate historical values
   - Historical data available for trend diagrams
   - Consistent comparison windows across all metrics
   - Efficient queries (simple SELECT from snapshot table)

## Future Enhancements (Optional)

- **Expand snapshots**: Consider storing additional metrics (share price, book value, EPS) in snapshots for faster historical diagram queries
- Fine-tuning of base adjustments and caps based on gameplay feedback
- Additional metrics if needed
