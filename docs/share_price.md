# Public Company & Share System Documentation

## Overview

The public company system allows players to issue shares, raise capital, pay dividends, and have their share price adjust based on company performance. The share price uses an incremental adjustment system that updates weekly based on multiple financial and operational metrics.

## Terminology Clarification

To avoid confusion, the following terms are used consistently throughout the system:

- **Company Value**: Total Assets - Total Liabilities. Used for prestige calculations, highscores, and achievements. Calculated via `calculateCompanyValue()`.
- **Market Cap**: Share Price × Total Shares. Used in share price contexts only. Represents the total market valuation of the company's shares.
- **Book Value Per Share**: (Total Assets - Total Liabilities) / Total Shares. Used as the anchor for share price calculations.
- **Total Contributions**: Initial capital contributions when creating a company (player cash + family contribution + outside investment). Used in starting conditions.

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

#### Unified Trend-Based System (48-Week Rolling Comparison)

**All metrics now use a unified trend-based comparison system:**
- Compare current 48-week rolling values to previous 48-week rolling values (from 48 weeks ago)
- Calculate actual improvement: `(Current 48w - Previous 48w) / Previous 48w × 100`
- Compare actual improvement to expected improvement rate
- Delta = Actual Improvement - Expected Improvement

**Metrics Using Trend-Based Comparison:**
- **Earnings/Share**: Current 48-week EPS vs. previous 48-week EPS
- **Revenue/Share**: Current 48-week revenue per share vs. previous 48-week revenue per share
- **Dividend/Share**: Current 48-week dividends per share vs. previous 48-week dividends per share
- **Revenue Growth**: Current 48-week growth rate vs. previous 48-week growth rate
- **Profit Margin**: Current 48-week profit margin vs. previous 48-week profit margin
- **Credit Rating**: Current credit rating vs. credit rating from 48 weeks ago
- **Fixed Asset Ratio**: Current fixed asset ratio vs. fixed asset ratio from 48 weeks ago
- **Prestige**: Current prestige vs. prestige from 48 weeks ago

**Historical Snapshots**: All metrics are stored weekly in the `company_metrics_history` table. When calculating deltas, the system queries the snapshot from exactly 48 weeks ago. This provides:
- Consistent 48-week comparison window across all metrics
- Historical data for trend diagrams
- No need for complex recalculation of past values

**Grace Period**: If a company is less than 48 weeks old, profitability metrics (EPS, Revenue/Share, Revenue Growth, Profit Margin) skip delta calculation (set to 0) since players cannot generate revenue before the first harvest. Trend-based metrics (Credit Rating, Fixed Asset Ratio, Prestige) also skip if company is less than 48 weeks old.

### Anchor Constraint

The book value per share acts as an "anchor" that constrains share price movements:

- **As price moves away from anchor**: Adjustments become smaller
- **No hard bounds**: Price can theoretically move far from book value, but it becomes incrementally harder
- **Formula**: `AnchorFactor = 1 / (1 + strength × deviation^exponent)`
  - Strength: 2.0
  - Exponent: 1.25
  - Deviation: `|currentPrice - bookValue| / bookValue`

### Expected Improvement Rates System

Expected improvement rates represent the baseline expected improvement when comparing current 48-week rolling values to previous 48-week rolling values. These rates are adjusted by multiple factors and then added to a company value requirement.

**Baseline Improvement Rates (per 48 weeks):**
- Earnings/Share: 1.2%
- Revenue/Share: 1.2%
- Dividend/Share: 0.3% (small, player-controlled)
- Revenue Growth: 1.2%
- Profit Margin: 0.8% (margins improve slowly)
- Credit Rating: 0.4% (slow improvement)
- Fixed Asset Ratio: 0.2% (very slow, strategic)
- Prestige: 0.5% (gradual prestige growth)

**Note**: These rates target 15-30x growth over 200 years, accounting for ups and downs. Since comparisons are to previous 48 weeks (not linear), actual growth will fluctuate.

#### Multipliers (Adjust Baseline by Context)

**Economy Phase Multipliers** (`ECONOMY_EXPECTATION_MULTIPLIERS`):
- Crash: 0.6
- Recession: 0.75
- Stable: 1.0
- Expansion: 1.25
- Boom: 1.5

**Prestige Multiplier:**
- Higher prestige companies face higher expectations
- Uses logarithmic scaling: `NormalizeScrewed1000To01WithTail(prestige)`
- Mapped to 1.0-3.0 multiplier range

**Growth Trend Multiplier:**
- Companies that consistently meet/exceed expectations face gradually increasing benchmarks
- Stored in database as `growthTrendMultiplier`
- Updated annually based on performance
- Adjusts expected improvement rates for all metrics

**Combined Multiplier Formula:**
```
Improvement Multiplier = Economy × Prestige × Growth Trend
```

#### Market Cap Requirement

As market cap increases, additional expected improvement is required. This is independent of the 48-week trend comparison and makes it progressively harder for larger companies to meet expectations.

**Formula:**
```
Market Cap Requirement = baseRate × log10(marketCap / baseMarketCap)
```

**Configuration:**
- Base Market Cap: €1M (no requirement below this)
- Base Rate: 0.2% per 48 weeks
- Max Rate: 1.0% (capped maximum requirement)

**Final Expected Improvement Rate:**
```
Expected Improvement = (Baseline × Improvement Multiplier) + Market Cap Requirement
```

**Example:**
- Baseline: 1.2% (Earnings/Share)
- Improvement Multiplier: 1.5 (Boom economy, high prestige, good growth trend)
- Market Cap Requirement: 0.3% (€10M market cap)
- Final Expected: (1.2% × 1.5) + 0.3% = 2.1% per 48 weeks

**Note:** Market Cap = Share Price × Total Shares. This is separate from Company Value (Total Assets - Total Liabilities), which is used for prestige and highscores.

## Share Management Features

### Share Issuance

- **Purpose**: Raise capital by selling new shares
- **Effect**: Dilutes player ownership (player shares stay the same, total shares increase)
- **Capital Raised**: `Shares Issued × Current Share Price`
- **Transaction**: Records capital inflow as "Outside Investment"
- **Immediate Price Impact**: Share price drops immediately due to dilution effect
  - Mathematical adjustment: `newPrice = oldPrice × (oldShares / newShares)`
  - Market reaction: Additional 3% penalty multiplier (dilution penalty)
  - Formula: `finalPrice = mathematicalPrice × 0.97`

### Share Buyback

- **Purpose**: Repurchase shares from the market
- **Effect**: Increases player ownership percentage
- **Cost**: `Shares Bought × Current Share Price`
- **Transaction**: Records capital outflow
- **Limit**: Cannot buy back more shares than are outstanding
- **Immediate Price Impact**: Share price rises immediately due to concentration effect
  - Mathematical adjustment: `newPrice = oldPrice × (oldShares / newShares)`
  - Market reaction: Additional 3% bonus multiplier (concentration bonus)
  - Formula: `finalPrice = mathematicalPrice × 1.03`

### Dividends

- **Rate**: Fixed per-share amount in euros (set by player)
- **Payment**: Annual payment calculated as `Dividend Rate × Total Shares`
- **Tracking**: System tracks dividends paid per share for current and previous year
- **Impact on Share Price**:
  - **Direct**: Dividend changes affect share price through the dividend per share metric (trend-based comparison)
  - **Indirect**: Dividend changes create prestige events with asymmetric impact:
    - **Dividend Cuts**: Larger negative prestige impact (0.5× multiplier)
    - **Dividend Increases**: Smaller positive prestige impact (0.3× multiplier)
    - Prestige impact decays over time (decay rate: 0.98)
    - Prestige affects share price through the prestige metric and expected improvement rates

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
  - Stores: `credit_rating`, `prestige`, `fixed_asset_ratio`, `share_price`, `book_value_per_share`, `earnings_per_share_48w`, `revenue_per_share_48w`, `dividend_per_share_48w`, `profit_margin_48w`, `revenue_growth_48w` at each snapshot
  - Used for: Trend calculations (comparing current vs. 48 weeks ago) and historical trend diagrams
  - Snapshots are automatically created each week when share price is adjusted
  - Provides consistent 48-week comparison windows across all metrics

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
  - `calculateIncrementalAdjustment()`: Core delta calculation logic (unified trend-based system)
  - `initializeSharePriceWithTimestamp()`: Initialize price on first use
  - `applyImmediateShareStructureAdjustment()`: Immediate price adjustment for share issuance/buyback
  - `calculateIncrementalAdjustmentDebug()`: Debug function for detailed calculation breakdown

- **`src/lib/services/finance/shareManagementService.ts`**
  - `issueStock()`: Issue new shares (triggers immediate price adjustment)
  - `buyBackStock()`: Repurchase shares (triggers immediate price adjustment)
  - `updateDividendRate()`: Set dividend rate (creates prestige events for changes)
  - `autoPayDividends()`: Automatically pay dividends on season change
  - `getShareMetrics()`: Calculate all per-share metrics (including 48-week rolling metrics)
  - `getShareholderBreakdown()`: Calculate ownership percentages
  - `getHistoricalShareMetrics()`: Historical per-share data (from snapshots)

- **`src/lib/database/core/companyMetricsHistoryDB.ts`**
  - `insertCompanyMetricsSnapshot()`: Store weekly snapshot of metrics
  - `getCompanyMetricsSnapshotNWeeksAgo()`: Query snapshot from N weeks ago (for 48-week comparisons)
  - `getCompanyMetricsHistory()`: Get all historical snapshots (for trend diagrams)

- **`src/lib/services/finance/growthTrendService.ts`**
  - `updateGrowthTrend()`: Annual update of growth trend multiplier based on performance

### Constants

- **`src/lib/constants/shareValuationConstants.ts`**
  - `EXPECTED_IMPROVEMENT_RATES`: Baseline improvement rates per 48 weeks (targeting 15-30x over 200 years)
  - `INCREMENTAL_METRIC_CONFIG`: Base adjustments and max ratios for each metric
  - `INCREMENTAL_ANCHOR_CONFIG`: Anchor constraint parameters
  - `PRESTIGE_SCALING`: Prestige multiplier configuration
  - `GROWTH_TREND_CONFIG`: Growth trend adjustment parameters
  - `MARKET_CAP_MODIFIER_CONFIG`: Market cap requirement configuration (additional expected improvement for larger companies)
  - `SHARE_STRUCTURE_ADJUSTMENT_CONFIG`: Immediate price adjustments for issuance/buyback
  - `DIVIDEND_CHANGE_PRESTIGE_CONFIG`: Prestige impact configuration for dividend changes

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
