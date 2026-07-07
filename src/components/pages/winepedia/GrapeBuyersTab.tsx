import {
  BUYER_LOYALTY_LEVELS,
  BUYER_LOYALTY_LEVEL_SEQUENCE,
  RELATIONSHIP_DECAY_BY_LEVEL,
  getBuyerYearlyLoyaltyCap,
} from '@/lib/services/sales/grapeBuyerLoyaltyService';
import {
  BASE_SEASONAL_BUYER_COUNT,
  BULK_BASE_SEASON_LIMIT_KG,
  BUYER_ECONOMY_LIMIT_MULTIPLIERS,
  BUYER_ECONOMY_PRICE_MULTIPLIERS,
  BUYER_SEASON_LIMIT_MULTIPLIERS,
  BUYER_SEASON_PRICE_MULTIPLIERS,
  COUNTRY_MULTIPLIER_RANGE,
  FAVORITE_GRAPE_PRIMARY_BONUS,
  FAVORITE_GRAPE_SECONDARY_BONUS,
  GRAPE_SALE_PRESTIGE_MAX_BONUS,
  MAX_SEASONAL_BUYER_COUNT,
} from '@/lib/constants';
import { formatNumber } from '@/lib/utils/utils';

const COMPANY_VALUE_SAMPLES = [100000, 1000000, 10000000];
const STREAK_SAMPLES = [1, 2, 3, 4, 5];

export function GrapeBuyersTab() {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-medium mb-1">Core Numbers</p>
        <ul className="text-xs space-y-1">
          <li>Seasonal buyer slots: base {BASE_SEASONAL_BUYER_COUNT}, max {MAX_SEASONAL_BUYER_COUNT}</li>
          <li>Bulk merchant base seasonal hard limit: {BULK_BASE_SEASON_LIMIT_KG.toLocaleString()} kg</li>
          <li>Favorite grape bonus: +{FAVORITE_GRAPE_PRIMARY_BONUS.toFixed(2)}x (primary), +{FAVORITE_GRAPE_SECONDARY_BONUS.toFixed(2)}x (secondary)</li>
          <li>Prestige sale bonus cap: +{Math.round(GRAPE_SALE_PRESTIGE_MAX_BONUS * 100)}%</li>
        </ul>
      </div>

      <div>
        <p className="font-medium mb-1">Relationship Levels</p>
        <div className="overflow-x-auto max-w-4xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-2">Level</th>
                <th className="py-1 pr-2">Name</th>
                <th className="py-1 pr-2">Loyalty Score Threshold</th>
                <th className="py-1 pr-2">Price Multiplier</th>
                <th className="py-1 pr-2">Season Limit Bonus</th>
                <th className="py-1 pr-2">Yearly Decay</th>
              </tr>
            </thead>
            <tbody>
              {BUYER_LOYALTY_LEVEL_SEQUENCE.map((level) => {
                const cfg = BUYER_LOYALTY_LEVELS[level];
                return (
                  <tr key={level} className="border-b">
                    <td className="py-1 pr-2">{level}</td>
                    <td className="py-1 pr-2">{cfg.name}</td>
                    <td className="py-1 pr-2">{cfg.minLoyaltyScore.toLocaleString()}</td>
                    <td className="py-1 pr-2">×{cfg.priceMultiplier.toFixed(2)}</td>
                    <td className="py-1 pr-2">+{Math.round(cfg.yearlyLimitBonus * 100)}%</td>
                    <td className="py-1 pr-2">{Math.round(RELATIONSHIP_DECAY_BY_LEVEL[level] * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="font-medium mb-1">Relationship Growth Cap Per Year (Scaled by Company Value)</p>
        <div className="overflow-x-auto max-w-5xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-2">Consecutive Years</th>
                {COMPANY_VALUE_SAMPLES.map((value) => (
                  <th key={value} className="py-1 pr-2">Company Value {formatNumber(value, { currency: true, decimals: 0 })}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STREAK_SAMPLES.map((years) => (
                <tr key={years} className="border-b">
                  <td className="py-1 pr-2">{years}</td>
                  {COMPANY_VALUE_SAMPLES.map((value) => (
                    <td key={`${years}-${value}`} className="py-1 pr-2">
                      {getBuyerYearlyLoyaltyCap(years, value).toLocaleString()} pts
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="font-medium mb-1">Season Demand Modifiers</p>
        <div className="overflow-x-auto max-w-4xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-2">Season</th>
                <th className="py-1 pr-2">Price Multiplier</th>
                <th className="py-1 pr-2">Limit Multiplier</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(BUYER_SEASON_PRICE_MULTIPLIERS) as Array<keyof typeof BUYER_SEASON_PRICE_MULTIPLIERS>).map((season) => (
                <tr key={season} className="border-b">
                  <td className="py-1 pr-2">{season}</td>
                  <td className="py-1 pr-2">×{BUYER_SEASON_PRICE_MULTIPLIERS[season].toFixed(2)}</td>
                  <td className="py-1 pr-2">×{BUYER_SEASON_LIMIT_MULTIPLIERS[season].toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="font-medium mb-1">Economy Demand Modifiers</p>
        <div className="overflow-x-auto max-w-4xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-2">Economy Phase</th>
                <th className="py-1 pr-2">Price Multiplier</th>
                <th className="py-1 pr-2">Limit Multiplier</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(BUYER_ECONOMY_PRICE_MULTIPLIERS) as Array<keyof typeof BUYER_ECONOMY_PRICE_MULTIPLIERS>).map((phase) => (
                <tr key={phase} className="border-b">
                  <td className="py-1 pr-2">{phase}</td>
                  <td className="py-1 pr-2">×{BUYER_ECONOMY_PRICE_MULTIPLIERS[phase].toFixed(2)}</td>
                  <td className="py-1 pr-2">×{BUYER_ECONOMY_LIMIT_MULTIPLIERS[phase].toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="font-medium mb-1">Seasonal Buyer Market Baselines (Before Loyalty/Research)</p>
        <div className="overflow-x-auto max-w-5xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-2">Country</th>
                <th className="py-1 pr-2">Multiplier Range</th>
                <th className="py-1 pr-2">Base Seasonal Limit Range</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(COUNTRY_MULTIPLIER_RANGE).map(([country, cfg]) => (
                <tr key={country} className="border-b">
                  <td className="py-1 pr-2">{country}</td>
                  <td className="py-1 pr-2">{cfg.min.toFixed(2)}x - {cfg.max.toFixed(2)}x</td>
                  <td className="py-1 pr-2">{cfg.baseLimitMin.toLocaleString()} - {cfg.baseLimitMax.toLocaleString()} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
