import { SimpleCard } from '@/components/ui';
import { getQualityInfo, getColorClass, getColorCategory, formatNumber } from '@/lib/utils/utils';

export function WineQualityTab() {
  return (
    <div className="space-y-6">
      <SimpleCard
        title="Land Value Modifier Categories"
        description="Understanding land-value modifier ratings and what they mean for your winery"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { min: 0.9, max: 1.0 },
              { min: 0.8, max: 0.9 },
              { min: 0.7, max: 0.8 },
              { min: 0.6, max: 0.7 },
              { min: 0.5, max: 0.6 },
              { min: 0.4, max: 0.5 },
              { min: 0.3, max: 0.4 },
              { min: 0.2, max: 0.3 },
              { min: 0.1, max: 0.2 },
              { min: 0.0, max: 0.1 }
            ].map((quality, index) => {
              const sampleQuality = (quality.min + quality.max) / 2;
              const qualityInfo = getQualityInfo(sampleQuality);
              const colorClass = getColorClass(sampleQuality);
              const qualityLabel = getColorCategory(sampleQuality);

              return (
                <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`font-semibold ${colorClass}`}>{qualityInfo.category}</h4>
                    <span className="text-sm text-gray-500">
                      {formatNumber(quality.min * 100, { decimals: 0, forceDecimals: true })}-{formatNumber(quality.max * 100, { decimals: 0, forceDecimals: true })}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{qualityInfo.description}</p>
                  <div className="text-xs text-gray-500">
                    Quality Level: <span className="font-medium">{qualityLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SimpleCard>

      <SimpleCard
        title="Quality Factors"
        description="What influences land value modifier and taste quality in your winery"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Land Value Modifier</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>- Regional land value and price band</li>
                <li>- Vineyard prestige and reputation</li>
                <li>- Altitude and aspect regional fit</li>
                <li>- Overgrowth and density penalties</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Taste Quality (Dynamic)</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>- Harvest-derived baseline characteristics</li>
                <li>- Fermentation and cellar feature effects</li>
                <li>- Bottle evolution over time</li>
                <li>- Interaction with structure index in wine score</li>
              </ul>
            </div>
          </div>
        </div>
      </SimpleCard>

      <SimpleCard
        title="Bulk Grape Market Prices"
        description="The usual direction of the factors that affect the price you pay for market grapes. Exact prices also reflect the current offer and are intentionally not shown as a formula."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Factor</th>
                <th className="px-3 py-2 font-medium">Usual price effect</th>
                <th className="px-3 py-2 font-medium">What it means</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-600">
              <tr>
                <td className="px-3 py-3 font-medium text-gray-800">Grape quality, structure & taste</td>
                <td className="px-3 py-3 text-amber-700">Higher quality → higher price</td>
                <td className="px-3 py-3">Stronger grapes and better wine potential command a premium.</td>
              </tr>
              <tr>
                <td className="px-3 py-3 font-medium text-gray-800">Terroir Expression and other positive features</td>
                <td className="px-3 py-3 text-amber-700">More expression → higher price</td>
                <td className="px-3 py-3">Terroir Expression is a positive feature that develops with the batch and usually makes bulk grapes more valuable.</td>
              </tr>
              <tr>
                <td className="px-3 py-3 font-medium text-gray-800">Manifested faults and pending risks</td>
                <td className="px-3 py-3 text-emerald-700">More downside → lower price</td>
                <td className="px-3 py-3">A present fault or meaningful chance of one lowers the value buyers are willing to pay.</td>
              </tr>
              <tr>
                <td className="px-3 py-3 font-medium text-gray-800">Market conditions</td>
                <td className="px-3 py-3 text-amber-700">Stronger demand → higher price</td>
                <td className="px-3 py-3">Season, economy, supply pressure, and volatility can raise or lower the market price.</td>
              </tr>
              <tr>
                <td className="px-3 py-3 font-medium text-gray-800">Supplier relationship</td>
                <td className="px-3 py-3 text-emerald-700">More trust → lower price</td>
                <td className="px-3 py-3">Buying consistently from a supplier can earn relationship terms and more reliable listings.</td>
              </tr>
              <tr>
                <td className="px-3 py-3 font-medium text-gray-800">Company reputation</td>
                <td className="px-3 py-3 text-amber-700">More prestige → can raise price</td>
                <td className="px-3 py-3">Established buyers can access a different scale of market supply, which may carry a higher price.</td>
              </tr>
              <tr>
                <td className="px-3 py-3 font-medium text-gray-800">Processing stage</td>
                <td className="px-3 py-3 text-amber-700">Further processing → can raise price</td>
                <td className="px-3 py-3">Fresh grapes, ready must, and fermenting must are priced differently because the supplier has already completed different work.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SimpleCard>

      <SimpleCard
        title="Bulk Price Calculation (Development Reference)"
        description="The current development formula is applied in this order. Multipliers above 1.00 raise the price; multipliers below 1.00 reduce it."
      >
        <div className="space-y-4 text-sm text-gray-600">
          <div className="rounded border bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-700">
            Final price = clamp(
            <br />
            base price × grape quality × market conditions × supplier relationship × company reputation × wine potential × processing stage × market spread,
            <br />
            minimum market price, maximum market price
            )
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Parameter</th>
                  <th className="px-3 py-2 font-medium">Includes</th>
                  <th className="px-3 py-2 font-medium">Direction</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-600">
                <tr><td className="px-3 py-2 font-medium text-gray-800">Base price</td><td className="px-3 py-2">Supplier and grape-market baseline</td><td className="px-3 py-2">Starting point</td></tr>
                <tr><td className="px-3 py-2 font-medium text-gray-800">Grape quality</td><td className="px-3 py-2">Offer quality score and asymmetrical quality curve</td><td className="px-3 py-2">Higher quality → higher price</td></tr>
                <tr><td className="px-3 py-2 font-medium text-gray-800">Season multiplier</td><td className="px-3 py-2">Current season’s market pattern</td><td className="px-3 py-2">Above 1.00 raises; below 1.00 reduces</td></tr>
                <tr><td className="px-3 py-2 font-medium text-gray-800">Economy multiplier</td><td className="px-3 py-2">Current economic phase</td><td className="px-3 py-2">Expansion raises; downturns reduce</td></tr>
                <tr><td className="px-3 py-2 font-medium text-gray-800">Year-cycle multiplier</td><td className="px-3 py-2">Longer market cycle position</td><td className="px-3 py-2">Above 1.00 raises; below 1.00 reduces</td></tr>
                <tr><td className="px-3 py-2 font-medium text-gray-800">Volatility × buyer sensitivity</td><td className="px-3 py-2">Weather/supply volatility and buyer response</td><td className="px-3 py-2">Tighter or more sensitive markets raise; softer markets reduce</td></tr>
                <tr><td className="px-3 py-2 font-medium text-gray-800">Supplier relationship</td><td className="px-3 py-2">Supplier loyalty level</td><td className="px-3 py-2">More loyalty → relationship discount</td></tr>
                <tr><td className="px-3 py-2 font-medium text-gray-800">Company reputation</td><td className="px-3 py-2">Company prestige discount, capped at 30%</td><td className="px-3 py-2">More prestige → lower price</td></tr>
                <tr><td className="px-3 py-2 font-medium text-gray-800">Preview quality multiplier</td><td className="px-3 py-2">Preview wine score = 75% structure/taste + 25% land value; clamped to 0.75–1.25 against source quality</td><td className="px-3 py-2">Higher preview quality raises; lower quality reduces</td></tr>
                <tr><td className="px-3 py-2 font-medium text-gray-800">Feature multiplier</td><td className="px-3 py-2">Price effects from manifested feature configuration</td><td className="px-3 py-2">Positive features raise; negative features reduce</td></tr>
                <tr><td className="px-3 py-2 font-medium text-gray-800">Risk multiplier</td><td className="px-3 py-2">Downside effects from pending feature risks</td><td className="px-3 py-2">Risks can only reduce the price</td></tr>
                <tr><td className="px-3 py-2 font-medium text-gray-800">Combined wine potential</td><td className="px-3 py-2">Preview quality × feature multiplier × risk multiplier</td><td className="px-3 py-2">Product of the three preview effects</td></tr>
                <tr><td className="px-3 py-2 font-medium text-gray-800">Processing stage</td><td className="px-3 py-2">Fresh grapes, ready must, or fermenting must</td><td className="px-3 py-2">Stage premium can raise or lower</td></tr>
                <tr><td className="px-3 py-2 font-medium text-gray-800">Market spread and floor</td><td className="px-3 py-2">Fixed spread plus minimum/maximum price clamp</td><td className="px-3 py-2">Spread raises the result; clamp limits extremes</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </SimpleCard>
    </div>
  );
}


