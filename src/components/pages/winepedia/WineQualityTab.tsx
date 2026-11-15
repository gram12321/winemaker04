import { ResponsiveComparisonTable, SimpleCard } from '@/components/ui';
import { getQualityInfo, getColorClass, getColorCategory, formatNumber } from '@/lib/utils/utils';

const marketPriceRows = [
  { id: 'quality', cells: ['Grape quality, structure & taste', <span className="text-amber-700">Higher quality → higher price</span>, 'Stronger grapes and better wine potential command a premium.'] },
  { id: 'features', cells: ['Terroir Expression and other positive features', <span className="text-amber-700">More expression → higher price</span>, 'Terroir Expression is a positive feature that develops with the batch and usually makes bulk grapes more valuable.'] },
  { id: 'faults', cells: ['Manifested faults and pending risks', <span className="text-emerald-700">More downside → lower price</span>, 'A present fault or meaningful chance of one lowers the value buyers are willing to pay.'] },
  { id: 'market', cells: ['Market conditions', <span className="text-amber-700">Stronger demand → higher price</span>, 'Season, economy, supply pressure, and volatility can raise or lower the market price.'] },
  { id: 'relationship', cells: ['Supplier relationship', <span className="text-emerald-700">More trust → lower price</span>, 'Buying consistently from a supplier can earn relationship terms and more reliable listings.'] },
  { id: 'reputation', cells: ['Company reputation', <span className="text-amber-700">More prestige can raise price</span>, 'Established buyers can access a different scale of market supply, which may carry a higher price.'] },
  { id: 'stage', cells: ['Processing stage', <span className="text-amber-700">Further processing can raise price</span>, 'Fresh grapes, ready must, and fermenting must are priced differently because the supplier has already completed different work.'] },
];

const calculationRows = [
  { id: 'base', cells: ['Base price', 'Supplier and grape-market baseline', 'Starting point'] },
  { id: 'quality', cells: ['Grape quality', 'Offer quality score and asymmetrical quality curve', 'Higher quality raises price'] },
  { id: 'season', cells: ['Season multiplier', 'Current season market pattern', 'Above 1.00 raises; below 1.00 reduces'] },
  { id: 'economy', cells: ['Economy multiplier', 'Current economic phase', 'Expansion raises; downturns reduce'] },
  { id: 'cycle', cells: ['Year-cycle multiplier', 'Longer market cycle position', 'Above 1.00 raises; below 1.00 reduces'] },
  { id: 'volatility', cells: ['Volatility × buyer sensitivity', 'Weather/supply volatility and buyer response', 'Tighter or more sensitive markets raise; softer markets reduce'] },
  { id: 'relationship', cells: ['Supplier relationship', 'Supplier loyalty level', 'More loyalty earns a relationship discount'] },
  { id: 'reputation', cells: ['Company reputation', 'Company prestige discount, capped at 30%', 'More prestige lowers price'] },
  { id: 'preview', cells: ['Preview quality multiplier', 'Preview wine score = 75% structure/taste + 25% land value; clamped to 0.75–1.25 against source quality', 'Higher preview quality raises; lower quality reduces'] },
  { id: 'feature', cells: ['Feature multiplier', 'Price effects from manifested feature configuration', 'Positive features raise; negative features reduce'] },
  { id: 'risk', cells: ['Risk multiplier', 'Downside effects from pending feature risks', 'Risks can only reduce the price'] },
  { id: 'potential', cells: ['Combined wine potential', 'Preview quality × feature multiplier × risk multiplier', 'Product of the three preview effects'] },
  { id: 'stage', cells: ['Processing stage', 'Fresh grapes, ready must, or fermenting must', 'Stage premium can raise or lower'] },
  { id: 'spread', cells: ['Market spread and floor', 'Fixed spread plus minimum/maximum price clamp', 'Spread raises the result; clamp limits extremes'] },
];

export function WineQualityTab() {
  return (
    <div className="min-w-0 space-y-6">
      <SimpleCard
        title="Land Value Modifier Categories"
        description="Understanding land-value modifier ratings and what they mean for your winery"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { min: 0.9, max: 1.0 }, { min: 0.8, max: 0.9 }, { min: 0.7, max: 0.8 }, { min: 0.6, max: 0.7 }, { min: 0.5, max: 0.6 },
            { min: 0.4, max: 0.5 }, { min: 0.3, max: 0.4 }, { min: 0.2, max: 0.3 }, { min: 0.1, max: 0.2 }, { min: 0.0, max: 0.1 },
          ].map((quality, index) => {
            const sampleQuality = (quality.min + quality.max) / 2;
            const qualityInfo = getQualityInfo(sampleQuality);
            const colorClass = getColorClass(sampleQuality);
            const qualityLabel = getColorCategory(sampleQuality);

            return (
              <div key={index} className="min-w-0 rounded-lg border p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className={`font-semibold ${colorClass}`}>{qualityInfo.category}</h4>
                  <span className="shrink-0 text-sm text-gray-500">
                    {formatNumber(quality.min * 100, { decimals: 0, forceDecimals: true })}-{formatNumber(quality.max * 100, { decimals: 0, forceDecimals: true })}%
                  </span>
                </div>
                <p className="mb-2 mt-1 text-sm text-gray-600">{qualityInfo.description}</p>
                <div className="text-xs text-gray-500">Quality Level: <span className="font-medium">{qualityLabel}</span></div>
              </div>
            );
          })}
        </div>
      </SimpleCard>

      <SimpleCard
        title="Quality Factors"
        description="What influences land value modifier and taste quality in your winery"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <h4 className="mb-2 font-semibold text-gray-800">Land Value Modifier</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>Regional land value and price band</li>
              <li>Vineyard prestige and reputation</li>
              <li>Altitude and aspect regional fit</li>
              <li>Overgrowth and density penalties</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-2 font-semibold text-gray-800">Taste Quality (Dynamic)</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>Harvest-derived baseline characteristics</li>
              <li>Fermentation and cellar feature effects</li>
              <li>Bottle evolution over time</li>
              <li>Interaction with structure index in wine score</li>
            </ul>
          </div>
        </div>
      </SimpleCard>

      <SimpleCard
        title="Bulk Grape Market Prices"
        description="The usual direction of the factors that affect the price you pay for market grapes. Exact prices also reflect the current offer and are intentionally not shown as a formula."
      >
        <ResponsiveComparisonTable
          label="Bulk grape market price factors"
          columns={['Factor', 'Usual price effect', 'What it means']}
          rows={marketPriceRows}
        />
      </SimpleCard>

      <SimpleCard
        title="Bulk Price Calculation (Development Reference)"
        description="The current development formula is applied in this order. Multipliers above 1.00 raise the price; multipliers below 1.00 reduce it."
      >
        <div className="mb-4 break-words rounded border bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-700">
          Final price = clamp(base price × grape quality × market conditions × supplier relationship × company reputation × wine potential × processing stage × market spread, minimum market price, maximum market price)
        </div>
        <ResponsiveComparisonTable
          label="Bulk grape price calculation parameters"
          columns={['Parameter', 'Includes', 'Direction']}
          rows={calculationRows}
        />
      </SimpleCard>
    </div>
  );
}
