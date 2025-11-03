import { ECONOMY_PHASES, ECONOMY_SALES_MULTIPLIERS } from '@/lib/constants/economyConstants';
import { ECONOMY_INTEREST_MULTIPLIERS } from '@/lib/constants/loanConstants';

export function EconomyTab() {
  return (
    <div className="space-y-3 text-sm">
      <p>
        The global economy moves between phases. Transitions occur mainly at season changes. The current
        phase affects sales and loans.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b">
              <th className="py-1 pr-2">Phase</th>
              <th className="py-1 pr-2">Customer Frequency</th>
              <th className="py-1 pr-2">Order Quantity</th>
              <th className="py-1 pr-2">Price Tolerance</th>
              <th className="py-1 pr-2">Multiple Orders</th>
              <th className="py-1 pr-2">Loan Interest</th>
            </tr>
          </thead>
          <tbody>
            {ECONOMY_PHASES.map((phase) => {
              const s = ECONOMY_SALES_MULTIPLIERS[phase];
              const i = ECONOMY_INTEREST_MULTIPLIERS[phase];
              return (
                <tr key={phase} className="border-b">
                  <td className="py-1 pr-2 font-medium">{phase}</td>
                  <td className="py-1 pr-2">×{s.frequencyMultiplier.toFixed(2)}</td>
                  <td className="py-1 pr-2">×{s.quantityMultiplier.toFixed(2)}</td>
                  <td className="py-1 pr-2">×{s.priceToleranceMultiplier.toFixed(2)}</td>
                  <td className="py-1 pr-2">×{s.multipleOrderPenaltyMultiplier.toFixed(2)}</td>
                  <td className="py-1 pr-2">×{i.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-1">
        <p className="font-medium">How phases shift</p>
        <p>
          Phases transition semi-randomly with higher stickiness at the edges (Crash/Boom) and more
          fluidity in the middle (Recovery/Expansion). Changes are processed during season changes.
        </p>
      </div>
    </div>
  );
}


