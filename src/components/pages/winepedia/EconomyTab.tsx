import { ECONOMY_INTEREST_MULTIPLIERS, ECONOMY_PHASES, ECONOMY_SALES_MULTIPLIERS } from '@/lib/constants/economyConstants';
import { BUY_MARKET_FIXED_SPREAD } from '@/lib/constants/buyGrapeMarketConstants';
import {
  BUYER_ECONOMY_LIMIT_MULTIPLIERS,
  BUYER_ECONOMY_PRICE_MULTIPLIERS,
  BUYER_ECONOMY_VOLATILITY_AMPLITUDE,
  BUYER_ECONOMY_VOLATILITY_PRESSURE,
} from '@/lib/constants/grapeBuyerMarketConstants';
import { ResponsiveComparisonTable } from '@/components/ui';

interface ComparisonRow {
  id: string;
  label: string;
  values: string[];
}

function EconomyComparison({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: ComparisonRow[];
}) {
  return (
    <section className="space-y-2">
      <h3 className="font-medium">{title}</h3>
      <ResponsiveComparisonTable
        label={title}
        columns={columns}
        rows={rows.map((row) => ({ id: row.id, cells: [row.label, ...row.values] }))}
      />
    </section>
  );
}

const multiplier = (value: number) => `×${value.toFixed(2)}`;

export function EconomyTab() {
  const impactRows: ComparisonRow[] = [
    { id: 'order-flow', label: 'Customer Order Flow', values: ['Low', 'Reduced', 'Baseline', 'Higher', 'High'] },
    { id: 'loan-interest', label: 'Loan Interest', values: ['High', 'Higher', 'Baseline', 'Lower', 'Low'] },
    { id: 'sell-price', label: 'Grape Sell Price', values: ['Weak', 'Soft', 'Baseline', 'Firm', 'Strong'] },
    { id: 'sell-limit', label: 'Grape Sell Demand Limit', values: ['Tight', 'Lower', 'Baseline', 'Higher', 'Wide'] },
    { id: 'buy-offer', label: 'Grape Buy Offer Baseline', values: ['Weak + Spread', 'Soft + Spread', 'Baseline + Spread', 'Firm + Spread', 'Strong + Spread'] },
  ];
  const salesRows = ECONOMY_PHASES.map((phase) => {
    const values = ECONOMY_SALES_MULTIPLIERS[phase];
    return {
      id: `sales-${phase}`,
      label: phase,
      values: [values.frequencyMultiplier, values.quantityMultiplier, values.priceToleranceMultiplier, values.multipleOrderPenaltyMultiplier].map(multiplier),
    };
  });
  const interestRows = ECONOMY_PHASES.map((phase) => ({
    id: `interest-${phase}`,
    label: phase,
    values: [multiplier(ECONOMY_INTEREST_MULTIPLIERS[phase])],
  }));
  const grapeSellRows = ECONOMY_PHASES.map((phase) => ({
    id: `sell-${phase}`,
    label: phase,
    values: [
      multiplier(BUYER_ECONOMY_PRICE_MULTIPLIERS[phase]),
      multiplier(BUYER_ECONOMY_LIMIT_MULTIPLIERS[phase]),
      multiplier(BUYER_ECONOMY_VOLATILITY_PRESSURE[phase]),
    ],
  }));
  const volatilityRows = ECONOMY_PHASES.map((phase) => ({
    id: `volatility-${phase}`,
    label: phase,
    values: [
      `±${Math.round(BUYER_ECONOMY_VOLATILITY_AMPLITUDE[phase].price * 100)}%`,
      `±${Math.round(BUYER_ECONOMY_VOLATILITY_AMPLITUDE[phase].limit * 100)}%`,
    ],
  }));
  const buyRows = ECONOMY_PHASES.map((phase) => {
    const base = BUYER_ECONOMY_PRICE_MULTIPLIERS[phase];
    return {
      id: `buy-${phase}`,
      label: phase,
      values: [multiplier(base), `+${Math.round(BUY_MARKET_FIXED_SPREAD * 100)}%`, multiplier(base * (1 + BUY_MARKET_FIXED_SPREAD))],
    };
  });

  return (
    <div className="min-w-0 space-y-5 text-sm">
      <p>
        The global economy moves between phases. Transitions occur mainly at season changes. The current
        phase affects sales flow, loans, and grape market pricing and demand.
      </p>

      <section className="space-y-1">
        <h3 className="font-medium">Where Economy Phase Is Currently Applied</h3>
        <ul className="list-disc space-y-1 pl-4 text-xs">
          <li>Customer acquisition and order generation frequency.</li>
          <li>Order quantity pressure and high-price tolerance behavior.</li>
          <li>Multiple-order chance through penalty modulation.</li>
          <li>Loan effective interest rates.</li>
          <li>Sell-side grape buyer pricing and demand limits.</li>
          <li>Buy-side grape offer pricing (sell-side demand context plus a fixed spread).</li>
        </ul>
      </section>

      <EconomyComparison
        title="Quick Impact Matrix (By Economy Phase)"
        columns={['System', ...ECONOMY_PHASES]}
        rows={impactRows}
      />

      <EconomyComparison
        title="Sales Modifiers"
        columns={['Phase', 'Customer Frequency', 'Order Quantity', 'Price Tolerance', 'Multiple Orders']}
        rows={salesRows}
      />
      <EconomyComparison
        title="Loan Interest Multipliers"
        columns={['Phase', 'Interest Multiplier']}
        rows={interestRows}
      />
      <EconomyComparison
        title="Grape Sell Market: Economy Multipliers"
        columns={['Phase', 'Sell Price Multiplier', 'Sell Demand Limit Multiplier', 'Volatility Pressure']}
        rows={grapeSellRows}
      />
      <EconomyComparison
        title="Grape Sell Market: Economy Volatility Amplitude"
        columns={['Phase', 'Price Shock Amplitude', 'Demand Shock Amplitude']}
        rows={volatilityRows}
      />
      <section className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Buy offers mirror the grape demand context and then add a fixed anti-arbitrage spread.
        </p>
        <EconomyComparison
          title="Grape Buy Market: Economy Impact"
          columns={['Phase', 'Mirrored Buy Baseline', 'Fixed Buy Spread', 'Economy + Spread']}
          rows={buyRows}
        />
      </section>

      <section className="space-y-1">
        <h3 className="font-medium">How phases shift</h3>
        <p>
          Phases transition semi-randomly with higher stickiness at the edges (Crash/Boom) and more
          fluidity in the middle (Recession/Stable/Expansion). Changes are processed during season changes.
        </p>
        <p>
          Strong phases make customers more tolerant of higher asking prices and improve order frequency/quantity.
          In downturns, customers become more selective and high asking prices are rejected more often.
        </p>
      </section>
    </div>
  );
}
