import { ECONOMY_PHASES, ECONOMY_SALES_MULTIPLIERS } from '@/lib/constants/economyConstants';
import { ECONOMY_INTEREST_MULTIPLIERS } from '@/lib/constants/economyConstants';

export function EconomyTab() {
  return (
    <div className="space-y-3 text-sm">
      <p>
        The global economy moves between phases. Transitions occur mainly at season changes. The current
        phase affects sales and loans.
      </p>

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
      </div>

      <div className="space-y-1">
        <p className="font-medium">How phases shift</p>
        <p>
          Phases transition semi-randomly with higher stickiness at the edges (Crash/Boom) and more
          fluidity in the middle (Recession/Stable/Expansion). Changes are processed during season changes.
        </p>
        <p>
        In strong economy phases the customers are more likely to accept a higher asking price, but they will not offer a higher price them self than they would in a weaker economyphase situration. 
        Strong phases makes the buyers more tolerant higher asking prices. In downturns, they won't bid lower than in a strong phase, yet they walk away more often if you try to charge too much
        </p>
      </div>
    </div>
  );
}


