# Public Company & Share System Documentation

## Overview

The public company system allows players to issue shares, raise capital, pay dividends, and have their share price adjust based on company performance. The share price uses an incremental adjustment system that updates weekly based on multiple financial and operational metrics.

## Share Price System

### Initial Share Price

When shares are first issued, the initial share price is simply:

```
Initial Share Price = Book Value per Share
```

Where Book Value per Share = (Total Equity) / (Total Shares)

Total Equity = Assets - Liabilities

### Incremental Adjustment System

After initialization, the share price adjusts incrementally each week based on how actual performance compares to expected values. This creates a "floating" price that gradually responds to company performance.

#### Adjustment Process

1. **Calculate Deltas**: For each metric, compare actual value to expected value (or previous value for trend-based metrics)
   - Calculate percentage difference: `(Actual - Expected) / Expected × 100`

2. **Convert to Euro Contribution**: Each metric's delta is converted to a euro amount based on its base adjustment value
   - Formula: `Delta_Ratio × Base_Adjustment` where Delta_Ratio is clamped to maxRatio
   - Each metric has a `baseAdjustment` (in euros) and `maxRatio` (cap on percentage contribution)

3. **Sum Contributions**: Sum all metric contributions to get total adjustment

4. **Apply Anchor Factor**: Multiply total adjustment by anchor factor
   - Anchor factor decreases as price moves further from book value
   - Formula: `1 / (1 + strength × deviation^exponent)`
   - This creates natural constraints without hard limits

5. **Update Price**: Add adjustment to current price
   - Price cannot fall below soft floor: `10% of book value`

### Metrics That Affect Share Price

All metrics contribute equally to the adjustment, with individual caps:

| Metric | Base Adjustment | Max Ratio | Type |
|--------|----------------|-----------|------|
| Revenue per Share | €0.05 | ±300% | Expected-based |
| Earnings per Share | €0.04 | ±300% | Expected-based |
| Dividend per Share | €0.03 | ±300% | Expected-based |
| Revenue Growth | €0.03 | ±200% | Expected-based |
| Profit Margin | €0.03 | ±200% | Expected-based |
| Credit Rating | €0.03 | ±200% | Trend-based |
| Fixed Asset Ratio | €0.02 | ±200% | Trend-based |
| Prestige | €0.02 | ±200% | Trend-based |

#### Expected-Based Metrics (48-Week Rolling Comparison)

Compare actual value over last 48 weeks to expected annual value:
- **Expected Value Calculation**: Uses baseline expectations adjusted by:
  - Economy phase multiplier
  - Prestige multiplier (logarithmic scaling)
  - Growth trend multiplier (based on historical performance)
- **Expected Baselines**:
  - Revenue Growth: 10% per year
  - Profit Margin: 15%
  - Earnings per Share: 10% return on book value
  - Revenue per Share: Calculated from expected EPS and expected profit margin

**48-Week Rolling Window**: All expected-based metrics use a rolling 48-week comparison:
- **Earnings/Share**: Last 48 weeks vs. expected annual (48 weeks) EPS
- **Revenue/Share**: Last 48 weeks vs. expected annual (48 weeks) revenue per share
- **Dividend/Share**: Last 48 weeks vs. expected dividend payments (based on company age within 48-week window)
- **Revenue Growth**: Compares last 48 weeks' revenue to previous 48 weeks' revenue
- **Profit Margin**: Last 48 weeks' net income / last 48 weeks' revenue

**Grace Period**: If a company is less than 48 weeks old, profitability metrics (EPS, Revenue/Share, Revenue Growth, Profit Margin) skip delta calculation (set to 0) since players cannot generate revenue before the first harvest.

#### Trend-Based Metrics (48-Week Rolling Comparison)

Compare current value to value from 48 weeks ago (stored in historical snapshots):
- **Credit Rating**: Percentage change compared to 48 weeks ago
- **Fixed Asset Ratio**: Percentage change compared to 48 weeks ago
- **Prestige**: Percentage change compared to 48 weeks ago

**Historical Snapshots**: All three trend-based metrics are stored weekly in the `company_metrics_history` table. When calculating deltas, the system queries the snapshot from exactly 48 weeks ago. This provides:
- Consistent 48-week comparison window (same as expected-based metrics)
- Historical data for trend diagrams
- No need for complex recalculation of past values

**Grace Period**: If a company is less than 48 weeks old, these metrics skip delta calculation (set to 0) to avoid penalizing new companies.

### Anchor Constraint

The book value per share acts as an "anchor" that constrains share price movements:

- **As price moves away from anchor**: Adjustments become smaller
- **No hard bounds**: Price can theoretically move far from book value, but it becomes incrementally harder
- **Formula**: `AnchorFactor = 1 / (1 + strength × deviation^exponent)`
  - Strength: 2.0
  - Exponent: 1.25
  - Deviation: `|currentPrice - bookValue| / bookValue`

### Expected Values System

Expected values adjust dynamically based on:

#### Economy Phase

Multipliers from `ECONOMY_EXPECTATION_MULTIPLIERS`:
- Crash: 0.6
- Recession: 0.75
- Stable: 1.0
- Expansion: 1.25
- Boom: 1.5

#### Prestige

Higher prestige companies face higher expectations:
- Uses logarithmic scaling: `NormalizeScrewed1000To01WithTail(prestige)`
- Mapped to 1.0-2.0 multiplier range

#### Growth Trend

Companies that consistently meet/exceed expectations face gradually increasing benchmarks:
- Stored in database as `growthTrendMultiplier`
- Updated annually based on performance
- Adjusts expected values for revenue growth, profit margin, and EPS

## Share Management Features

### Share Issuance

- **Purpose**: Raise capital by selling new shares
- **Effect**: Dilutes player ownership (player shares stay the same, total shares increase)
- **Capital Raised**: `Shares Issued × Current Share Price`
- **Transaction**: Records capital inflow as "Outside Investment"

### Share Buyback

- **Purpose**: Repurchase shares from the market
- **Effect**: Increases player ownership percentage
- **Cost**: `Shares Bought × Current Share Price`
- **Transaction**: Records capital outflow
- **Limit**: Cannot buy back more shares than are outstanding

### Dividends

- **Rate**: Fixed per-share amount in euros (set by player)
- **Payment**: Annual payment calculated as `Dividend Rate × Total Shares`
- **Tracking**: System tracks dividends paid per share for current and previous year
- **Impact**: Dividend changes affect share price through the dividend per share metric

### Shareholder Breakdown

The system tracks:
- **Player Shares**: Shares owned by the player (founder/family)
- **Outstanding Shares**: Shares available on the market (total - player shares)
- **Ownership Percentages**: Calculated for player vs. outside investors
- **Historical Metrics**: Tracks revenue per share, earnings per share, dividends per share over time

## Share Metrics

The `ShareMetrics` interface provides per-share calculations:

- **Asset Per Share**: Total assets / total shares
- **Cash Per Share**: Cash / total shares
- **Debt Per Share**: Total debt / total shares
- **Book Value Per Share**: (Assets - Liabilities) / total shares
- **Revenue Per Share**: Current year revenue / total shares
- **Earnings Per Share**: Current year net income / total shares
- **Dividend Per Share (Current Year)**: Total dividends paid this year / total shares
- **Dividend Per Share (Previous Year)**: Total dividends paid last year / total shares
- **Credit Rating**: Overall financial health (0-1 scale)
- **Profit Margin**: Net income / revenue ratio
- **Revenue Growth**: Year-over-year revenue growth percentage

## Database Fields

### Company Table

**Share Structure:**
- `totalShares`: Total number of shares issued
- `outstandingShares`: Shares available on the market (excluding player shares)
- `playerShares`: Shares owned by the player

**Pricing:**
- `sharePrice`: Current share price (updated incrementally)
- `marketCap`: Total market capitalization (sharePrice × totalShares)
- `lastSharePriceUpdate`: When price was last adjusted

**Dividends:**
- `dividendRate`: Fixed per-share dividend in euros
- `lastDividendPaid`: Date of last dividend payment

**Valuation Tracking:**
- `growthTrendMultiplier`: Historical performance multiplier for expected values
- `lastGrowthTrendUpdate`: When growth trend was last recalculated

### Company Metrics History Table

**Historical Snapshots:**
- `company_metrics_history`: Weekly snapshots of company metrics for 48-week rolling comparisons
  - Stores: `credit_rating`, `prestige`, `fixed_asset_ratio` at each snapshot
  - Used for: Trend calculations (comparing current vs. 48 weeks ago) and historical trend diagrams
  - Snapshots are automatically created each week when share price is adjusted

**Note**: The previous tick values (`previousCreditRating`, `previousFixedAssetRatio`, `previousPrestige`) are deprecated in favor of the snapshot system, which provides more consistent 48-week comparisons.

## Key Files

### Services

- **`src/lib/services/finance/shareValuationService.ts`**
  - `calculateSharePrice()`: Returns book value per share (initial price)
  - `calculateExpectedValues()`: Calculates expected performance benchmarks
  - `calculateMarketCap()`: Market capitalization calculation
  - `getCurrentSharePrice()`: Get current price from database
  - `getMarketValue()`: Get current share price and market cap

- **`src/lib/services/finance/sharePriceIncrementService.ts`**
  - `adjustSharePriceIncrementally()`: Weekly share price adjustment
  - `calculateIncrementalAdjustment()`: Core delta calculation logic
  - `initializeSharePriceWithTimestamp()`: Initialize price on first use

- **`src/lib/services/finance/shareManagementService.ts`**
  - `issueStock()`: Issue new shares
  - `buyBackStock()`: Repurchase shares
  - `updateDividendRate()`: Set dividend rate
  - `autoPayDividends()`: Automatically pay dividends on season change
  - `getShareMetrics()`: Calculate all per-share metrics (including 48-week rolling metrics)
  - `getShareholderBreakdown()`: Calculate ownership percentages
  - `getHistoricalShareMetrics()`: Historical per-share data (recalculated from transactions)

- **`src/lib/database/core/companyMetricsHistoryDB.ts`**
  - `insertCompanyMetricsSnapshot()`: Store weekly snapshot of metrics
  - `getCompanyMetricsSnapshotNWeeksAgo()`: Query snapshot from N weeks ago (for 48-week comparisons)
  - `getCompanyMetricsHistory()`: Get all historical snapshots (for trend diagrams)

- **`src/lib/services/finance/growthTrendService.ts`**
  - `updateGrowthTrend()`: Annual update of growth trend multiplier based on performance

### Constants

- **`src/lib/constants/shareValuationConstants.ts`**
  - `EXPECTED_VALUE_BASELINES`: Base expectations for revenue growth and profit margin
  - `INCREMENTAL_METRIC_CONFIG`: Base adjustments and max ratios for each metric
  - `INCREMENTAL_ANCHOR_CONFIG`: Anchor constraint parameters
  - `PRESTIGE_SCALING`: Prestige multiplier configuration
  - `GROWTH_TREND_CONFIG`: Growth trend adjustment parameters

- **`src/lib/constants/economyConstants.ts`**
  - `ECONOMY_EXPECTATION_MULTIPLIERS`: Economy phase multipliers for expected values

### UI Components

- **`src/components/finance/ShareManagementPanel.tsx`**: Main UI for share management
  - Share issuance and buyback controls
  - Dividend rate setting and payment
  - Shareholder breakdown visualization
  - Historical metrics charts
  - Share price debug panel with detailed adjustment breakdown

- **`src/components/pages/winepedia/ShareMarketTab.tsx`**: Educational explanation of the system

## Integration Points

### Game Tick

- **Weekly**: `adjustSharePriceIncrementally()` is called in `gameTick.ts` during weekly processing
- **Annual**: `updateGrowthTrend()` is called at the start of each new year

### Financial Transactions

- Share issuance creates capital inflow transaction
- Share buyback creates capital outflow transaction
- Dividend payments create expense transactions

### Notifications

- Players receive notifications when:
  - Shares are successfully issued or bought back
  - Dividends are due or paid
  - Major share price movements occur

## Design Principles

1. **No Double-Counting**: Credit rating is used as a single financial health signal. Individual credit components are not separately factored into share price.

2. **Incremental Updates**: Share price adjusts gradually each week, creating realistic price movements rather than sudden jumps.

3. **Natural Constraints**: The anchor factor creates bounds without hard limits, making extreme prices harder but not impossible to achieve.

4. **Performance-Driven**: Price reflects actual company performance compared to dynamically adjusting expectations that scale with success.

5. **Transparency**: All calculations are visible in the debug panel, allowing players to understand how their actions affect share price.
