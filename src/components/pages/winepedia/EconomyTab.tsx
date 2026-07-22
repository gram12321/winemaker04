import { ECONOMY_PHASES, ECONOMY_SALES_MULTIPLIERS } from '@/lib/constants/economyConstants';
import { ECONOMY_INTEREST_MULTIPLIERS } from '@/lib/constants/economyConstants';
import { BUY_MARKET_FIXED_SPREAD } from '@/lib/constants/buyGrapeMarketConstants';
import { BUYER_ECONOMY_LIMIT_MULTIPLIERS, BUYER_ECONOMY_PRICE_MULTIPLIERS, BUYER_ECONOMY_VOLATILITY_AMPLITUDE, BUYER_ECONOMY_VOLATILITY_PRESSURE } from '@/lib/constants/grapeBuyerMarketConstants';

export function EconomyTab() {
  return (
    <div className="space-y-3 text-sm">
      <p>
        The global economy moves between phases. Transitions occur mainly at season changes. The current
        phase affects sales flow, loans, and grape market pricing/demand behavior.
      </p>

      <div className="space-y-1">
        <p className="font-medium">Where Economy Phase Is Currently Applied</p>
        <ul className="text-xs space-y-1 list-disc pl-4">
          <li>Customer acquisition and order generation frequency.</li>
          <li>Order quantity pressure and high-price tolerance behavior.</li>
          <li>Multiple-order chance through penalty modulation.</li>
          <li>Loan effective interest rates.</li>
          <li>Sell-side grape buyer pricing and demand limits.</li>
          <li>Buy-side grape offer pricing (mirrors sell-side demand context + fixed spread).</li>
        </ul>
      </div>

      <div>
        <p className="font-medium mb-1">Quick Impact Matrix (By Economy Phase)</p>
        <div className="overflow-x-auto max-w-5xl mx-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-2">System</th>
                <th className="py-1 pr-2">Crash</th>
                <th className="py-1 pr-2">Recession</th>
                <th className="py-1 pr-2">Stable</th>
                <th className="py-1 pr-2">Expansion</th>
                <th className="py-1 pr-2">Boom</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-1 pr-2 font-medium">Customer Order Flow</td>
                <td className="py-1 pr-2">Low</td>
                <td className="py-1 pr-2">Reduced</td>
                <td className="py-1 pr-2">Baseline</td>
                <td className="py-1 pr-2">Higher</td>
                <td className="py-1 pr-2">High</td>
              </tr>
              <tr className="border-b">
                <td className="py-1 pr-2 font-medium">Loan Interest</td>
                <td className="py-1 pr-2">High</td>
                <td className="py-1 pr-2">Higher</td>
                <td className="py-1 pr-2">Baseline</td>
                <td className="py-1 pr-2">Lower</td>
                <td className="py-1 pr-2">Low</td>
              </tr>
              <tr className="border-b">
                <td className="py-1 pr-2 font-medium">Grape Sell Price</td>
                <td className="py-1 pr-2">Weak</td>
                <td className="py-1 pr-2">Soft</td>
                <td className="py-1 pr-2">Baseline</td>
                <td className="py-1 pr-2">Firm</td>
                <td className="py-1 pr-2">Strong</td>
              </tr>
              <tr className="border-b">
                <td className="py-1 pr-2 font-medium">Grape Sell Demand Limit</td>
                <td className="py-1 pr-2">Tight</td>
                <td className="py-1 pr-2">Lower</td>
                <td className="py-1 pr-2">Baseline</td>
                <td className="py-1 pr-2">Higher</td>
                <td className="py-1 pr-2">Wide</td>
              </tr>
              <tr>
                <td className="py-1 pr-2 font-medium">Grape Buy Offer Baseline</td>
                <td className="py-1 pr-2">Weak + Spread</td>
                <td className="py-1 pr-2">Soft + Spread</td>
                <td className="py-1 pr-2">Baseline + Spread</td>
                <td className="py-1 pr-2">Firm + Spread</td>
                <td className="py-1 pr-2">Strong + Spread</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        {/* Sales modifiers */}
        <div>
          <p className="font-medium mb-1">Sales Modifiers</p>
          <div className="overflow-x-auto max-w-3xl mx-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-2">Phase</th>
                  <th className="py-1 pr-2">Customer Frequency</th>
                  <th className="py-1 pr-2">Order Quantity</th>
                  <th className="py-1 pr-2">Price Tolerance</th>
                  <th className="py-1 pr-2">Multiple Orders</th>
                </tr>
              </thead>
              <tbody>
                {ECONOMY_PHASES.map((phase) => {
                  const s = ECONOMY_SALES_MULTIPLIERS[phase];
                  return (
                    <tr key={phase} className="border-b">
                      <td className="py-1 pr-2 font-medium">{phase}</td>
                      <td className="py-1 pr-2">×{s.frequencyMultiplier.toFixed(2)}</td>
                      <td className="py-1 pr-2">×{s.quantityMultiplier.toFixed(2)}</td>
                      <td className="py-1 pr-2">×{s.priceToleranceMultiplier.toFixed(2)}</td>
                      <td className="py-1 pr-2">×{s.multipleOrderPenaltyMultiplier.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Loan interest */}
        <div>
          <p className="font-medium mb-1">Loan Interest Multipliers</p>
          <div className="overflow-x-auto max-w-2xl mx-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-2">Phase</th>
                  <th className="py-1 pr-2">Interest Multiplier</th>
                </tr>
              </thead>
              <tbody>
                {ECONOMY_PHASES.map((phase) => {
                  const i = ECONOMY_INTEREST_MULTIPLIERS[phase];
                  return (
                    <tr key={`loan-${phase}`} className="border-b">
                      <td className="py-1 pr-2 font-medium">{phase}</td>
                      <td className="py-1 pr-2">×{i.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className="font-medium mb-1">Grape Sell Market: Economy Multipliers</p>
          <div className="overflow-x-auto max-w-4xl mx-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-2">Phase</th>
                  <th className="py-1 pr-2">Sell Price Multiplier</th>
                  <th className="py-1 pr-2">Sell Demand Limit Multiplier</th>
                  <th className="py-1 pr-2">Volatility Pressure</th>
                </tr>
              </thead>
              <tbody>
                {ECONOMY_PHASES.map((phase) => (
                  <tr key={`grape-sell-${phase}`} className="border-b">
                    <td className="py-1 pr-2 font-medium">{phase}</td>
                    <td className="py-1 pr-2">×{BUYER_ECONOMY_PRICE_MULTIPLIERS[phase].toFixed(2)}</td>
                    <td className="py-1 pr-2">×{BUYER_ECONOMY_LIMIT_MULTIPLIERS[phase].toFixed(2)}</td>
                    <td className="py-1 pr-2">×{BUYER_ECONOMY_VOLATILITY_PRESSURE[phase].toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className="font-medium mb-1">Grape Sell Market: Economy Volatility Amplitude</p>
          <div className="overflow-x-auto max-w-4xl mx-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-2">Phase</th>
                  <th className="py-1 pr-2">Price Shock Amplitude</th>
                  <th className="py-1 pr-2">Demand Shock Amplitude</th>
                </tr>
              </thead>
              <tbody>
                {ECONOMY_PHASES.map((phase) => (
                  <tr key={`grape-vol-${phase}`} className="border-b">
                    <td className="py-1 pr-2 font-medium">{phase}</td>
                    <td className="py-1 pr-2">±{Math.round(BUYER_ECONOMY_VOLATILITY_AMPLITUDE[phase].price * 100)}%</td>
                    <td className="py-1 pr-2">±{Math.round(BUYER_ECONOMY_VOLATILITY_AMPLITUDE[phase].limit * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className="font-medium mb-1">Grape Buy Market: Economy Impact</p>
          <p className="text-xs text-gray-300 mb-2">
            Buy offers mirror the grape demand context and then add a fixed anti-arbitrage spread.
          </p>
          <div className="overflow-x-auto max-w-4xl mx-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-2">Phase</th>
                  <th className="py-1 pr-2">Mirrored Buy Baseline (Economy)</th>
                  <th className="py-1 pr-2">Fixed Buy Spread</th>
                  <th className="py-1 pr-2">Economy + Spread (Baseline)</th>
                </tr>
              </thead>
              <tbody>
                {ECONOMY_PHASES.map((phase) => {
                  const base = BUYER_ECONOMY_PRICE_MULTIPLIERS[phase];
                  const withSpread = base * (1 + BUY_MARKET_FIXED_SPREAD);
                  return (
                    <tr key={`grape-buy-${phase}`} className="border-b">
                      <td className="py-1 pr-2 font-medium">{phase}</td>
                      <td className="py-1 pr-2">×{base.toFixed(2)}</td>
                      <td className="py-1 pr-2">+{Math.round(BUY_MARKET_FIXED_SPREAD * 100)}%</td>
                      <td className="py-1 pr-2">×{withSpread.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <p className="font-medium">How phases shift</p>
        <p>
          Phases transition semi-randomly with higher stickiness at the edges (Crash/Boom) and more
          fluidity in the middle (Recession/Stable/Expansion). Changes are processed during season changes.
        </p>
        <p>
          Strong phases make customers more tolerant of higher asking prices and improve order frequency/quantity.
          In downturns, customers become more selective and high asking prices are rejected more often.
        </p>
      </div>
    </div>
  );
}


