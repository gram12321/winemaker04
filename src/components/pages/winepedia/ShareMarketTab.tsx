import { SimpleCard } from '@/components/ui';
import { EXPECTED_VALUE_BASELINES, GROWTH_TREND_CONFIG, INCREMENTAL_METRIC_CONFIG } from '@/lib/constants/shareValuationConstants';
import { ECONOMY_EXPECTATION_MULTIPLIERS, ECONOMY_PHASES } from '@/lib/constants/economyConstants';
import { formatNumber } from '@/lib/utils/utils';

export function ShareMarketTab() {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h2 className="text-lg font-semibold mb-2">Share Price System</h2>
        <p className="text-gray-600 mb-4">
          Share prices use an incremental adjustment system that updates weekly based on your company's performance. 
          The initial share price equals book value per share, then adjusts incrementally each week based on multiple metrics.
        </p>
      </div>

      <SimpleCard title="Initial Share Price">
        <h3 className="font-semibold mb-3">Initial Share Price</h3>
        <div className="space-y-2 text-xs">
          <div>
            <strong>Initial Price = Book Value per Share</strong>
          </div>
          <div className="text-gray-600">
            When shares are first issued, the initial price is simply the company's book value (total equity) divided by the number of shares.
          </div>
        </div>
      </SimpleCard>

      <div>
        <h3 className="font-semibold mb-2">Incremental Adjustment System</h3>
        <p className="text-gray-600 mb-3 text-xs">
          Each week, the share price adjusts based on how your company's metrics compare to expected values. 
          Each metric contributes a small adjustment (in euros) to the share price.
        </p>
        
        <SimpleCard title="Metrics That Affect Share Price">
          <div className="space-y-3 text-xs">
            <div>
              <strong>Earnings per Share (48-week rolling):</strong> Actual earnings over last 48 weeks compared to expected
              <div className="text-gray-500 mt-1">
                Base adjustment: {formatNumber(INCREMENTAL_METRIC_CONFIG.earningsPerShare.baseAdjustment, { currency: true, decimals: 2 })}
              </div>
            </div>
            <div>
              <strong>Revenue per Share (48-week rolling):</strong> Actual revenue over last 48 weeks compared to expected
              <div className="text-gray-500 mt-1">
                Base adjustment: {formatNumber(INCREMENTAL_METRIC_CONFIG.revenuePerShare.baseAdjustment, { currency: true, decimals: 2 })}
              </div>
            </div>
            <div>
              <strong>Dividend per Share (48-week rolling):</strong> Total dividends paid over last 48 weeks compared to expected
              <div className="text-gray-500 mt-1">
                Base adjustment: {formatNumber(INCREMENTAL_METRIC_CONFIG.dividendPerShare.baseAdjustment, { currency: true, decimals: 2 })}
              </div>
            </div>
            <div>
              <strong>Revenue Growth (48-week rolling):</strong> Revenue growth comparing last 48 weeks to previous 48 weeks
              <div className="text-gray-500 mt-1">
                Base adjustment: {formatNumber(INCREMENTAL_METRIC_CONFIG.revenueGrowth.baseAdjustment, { currency: true, decimals: 2 })}
              </div>
            </div>
            <div>
              <strong>Profit Margin (48-week rolling):</strong> Actual profit margin over last 48 weeks compared to expected
              <div className="text-gray-500 mt-1">
                Base adjustment: {formatNumber(INCREMENTAL_METRIC_CONFIG.profitMargin.baseAdjustment, { currency: true, decimals: 2 })}
              </div>
            </div>
            <div>
              <strong>Credit Rating (48-week rolling):</strong> Current credit rating compared to 48 weeks ago
              <div className="text-gray-500 mt-1">
                Base adjustment: {formatNumber(INCREMENTAL_METRIC_CONFIG.creditRating.baseAdjustment, { currency: true, decimals: 2 })}
              </div>
            </div>
            <div>
              <strong>Fixed Asset Ratio (48-week rolling):</strong> Current fixed asset ratio compared to 48 weeks ago
              <div className="text-gray-500 mt-1">
                Base adjustment: {formatNumber(INCREMENTAL_METRIC_CONFIG.fixedAssetRatio.baseAdjustment, { currency: true, decimals: 2 })}
              </div>
            </div>
            <div>
              <strong>Prestige (48-week rolling):</strong> Current prestige compared to 48 weeks ago
              <div className="text-gray-500 mt-1">
                Base adjustment: {formatNumber(INCREMENTAL_METRIC_CONFIG.prestige.baseAdjustment, { currency: true, decimals: 2 })}
              </div>
            </div>
          </div>
        </SimpleCard>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Expected Values</h3>
        <p className="text-gray-600 mb-3 text-xs">
          Expected performance benchmarks adjust dynamically based on:
        </p>
        <div className="space-y-2">
          <SimpleCard title="Expected Value Baselines">
            <div className="text-xs space-y-2">
              <div>
                <strong>Revenue Growth Baseline:</strong> {formatNumber(EXPECTED_VALUE_BASELINES.revenueGrowth, { percent: true, decimals: 0, percentIsDecimal: true })} per year
              </div>
              <div>
                <strong>Profit Margin Baseline:</strong> {formatNumber(EXPECTED_VALUE_BASELINES.profitMargin, { percent: true, decimals: 0, percentIsDecimal: true })}
              </div>
            </div>
          </SimpleCard>
          
          <SimpleCard title="Adjustment Factors">
            <div className="text-xs space-y-1">
              <div><strong>Economy Phase:</strong> Boom phases expect better performance than Crash phases</div>
              <div><strong>Prestige:</strong> Higher prestige companies face higher expectations</div>
              <div>
                <strong>Growth Trends:</strong> Companies that consistently meet or exceed expectations face gradually increasing benchmarks 
                (adjustment: {formatNumber(GROWTH_TREND_CONFIG.adjustmentIncrement, { percent: true, decimals: 0, percentIsDecimal: true })} per period)
              </div>
            </div>
          </SimpleCard>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Anchor Constraint</h3>
        <SimpleCard title="Book Value Anchor">
          <div className="text-xs space-y-2">
            <div>
              <strong>Book Value as Anchor:</strong> The share price is constrained by book value per share. 
              As the price moves further away from book value, adjustments become smaller. This creates natural bounds 
              without hard limits - it becomes incrementally harder to move far from the anchor.
            </div>
            <div className="text-gray-500">
              This means the share price tends to stay relatively close to book value, but can still move significantly 
              if performance consistently exceeds or falls short of expectations.
            </div>
          </div>
        </SimpleCard>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Market Factors</h3>
        <SimpleCard title="Economy Phase">
          <div className="space-y-2 text-xs">
            <div>
              <strong>Economy Phase:</strong> Current economic conditions affect expected performance benchmarks.
            </div>
            <div className="overflow-x-auto max-w-2xl mx-auto mt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-1 pr-2">Phase</th>
                    <th className="py-1 pr-2">Expectation Multiplier</th>
                  </tr>
                </thead>
                <tbody>
                  {ECONOMY_PHASES.map((phase) => (
                    <tr key={phase} className="border-b">
                      <td className="py-1 pr-2 font-medium">{phase}</td>
                      <td className="py-1 pr-2">×{ECONOMY_EXPECTATION_MULTIPLIERS[phase].toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SimpleCard>
      </div>

      <div>
        <h3 className="font-semibold mb-2">How It Works</h3>
        <SimpleCard title="Adjustment Process">
          <div className="text-xs space-y-2">
            <div>
              <strong>1. Calculate Deltas:</strong> For each metric, compare actual value to expected value. 
              Calculate the percentage difference (delta).
            </div>
            <div>
              <strong>2. Convert to Euro Contribution:</strong> Each metric's delta is converted to a euro amount 
              based on its base adjustment value. Metrics are capped to prevent extreme swings.
            </div>
            <div>
              <strong>3. Apply Anchor Factor:</strong> Sum all metric contributions, then multiply by an anchor factor 
              that decreases as price moves further from book value.
            </div>
            <div>
              <strong>4. Update Price:</strong> Add the final adjustment to the current share price. 
              The price cannot fall below a soft floor (10% of book value).
            </div>
          </div>
        </SimpleCard>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Key Features</h3>
        <SimpleCard title="Key Features">
          <div className="text-xs space-y-2">
            <div>
              <strong>Incremental Updates:</strong> Share price adjusts gradually each week, creating a more realistic 
              "floating" price rather than sudden jumps.
            </div>
            <div>
              <strong>Natural Constraints:</strong> The anchor factor creates natural bounds without hard limits, 
              making extreme prices harder but not impossible to achieve.
            </div>
            <div>
              <strong>Performance-Driven:</strong> Price reflects actual company performance compared to dynamically 
              adjusting expectations.
            </div>
            <div>
              <strong>No Double-Counting:</strong> Credit rating is used as a single financial health signal. 
              Individual credit components are not separately factored into share price.
            </div>
          </div>
        </SimpleCard>
      </div>
    </div>
  );
}
