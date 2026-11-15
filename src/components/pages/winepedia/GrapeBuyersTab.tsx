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
  MAX_SEASONAL_BUYER_COUNT,
} from '@/lib/constants/grapeBuyerMarketConstants';
import { FAVORITE_GRAPE_PRIMARY_BONUS, FAVORITE_GRAPE_SECONDARY_BONUS, GRAPE_SALE_PRESTIGE_MAX_BONUS } from '@/lib/constants/sellGrapesConstants';
import { ResponsiveComparisonTable } from '@/components/ui';
import { formatNumber } from '@/lib/utils/utils';

const COMPANY_VALUE_SAMPLES = [100000, 1000000, 10000000];
const STREAK_SAMPLES = [1, 2, 3, 4, 5];

export function GrapeBuyersTab() {
  const relationshipRows = BUYER_LOYALTY_LEVEL_SEQUENCE.map((level) => {
    const config = BUYER_LOYALTY_LEVELS[level];
    return {
      id: `relationship-${level}`,
      cells: [
        level,
        config.name,
        config.minLoyaltyScore.toLocaleString(),
        `×${config.priceMultiplier.toFixed(2)}`,
        `+${Math.round(config.yearlyLimitBonus * 100)}%`,
        `${Math.round(RELATIONSHIP_DECAY_BY_LEVEL[level] * 100)}%`,
      ],
    };
  });
  const growthRows = STREAK_SAMPLES.map((years) => ({
    id: `growth-${years}`,
    cells: [
      `${years} ${years === 1 ? 'year' : 'years'}`,
      ...COMPANY_VALUE_SAMPLES.map((value) => `${getBuyerYearlyLoyaltyCap(years, value).toLocaleString()} pts`),
    ],
  }));
  const seasons = Object.keys(BUYER_SEASON_PRICE_MULTIPLIERS) as Array<keyof typeof BUYER_SEASON_PRICE_MULTIPLIERS>;
  const seasonRows = seasons.map((season) => ({
    id: `season-${season}`,
    cells: [season, `×${BUYER_SEASON_PRICE_MULTIPLIERS[season].toFixed(2)}`, `×${BUYER_SEASON_LIMIT_MULTIPLIERS[season].toFixed(2)}`],
  }));
  const phases = Object.keys(BUYER_ECONOMY_PRICE_MULTIPLIERS) as Array<keyof typeof BUYER_ECONOMY_PRICE_MULTIPLIERS>;
  const economyRows = phases.map((phase) => ({
    id: `economy-${phase}`,
    cells: [phase, `×${BUYER_ECONOMY_PRICE_MULTIPLIERS[phase].toFixed(2)}`, `×${BUYER_ECONOMY_LIMIT_MULTIPLIERS[phase].toFixed(2)}`],
  }));
  const baselineRows = Object.entries(COUNTRY_MULTIPLIER_RANGE).map(([country, config]) => ({
    id: `country-${country}`,
    cells: [country, `${config.min.toFixed(2)}×–${config.max.toFixed(2)}×`, `${config.baseLimitMin.toLocaleString()}–${config.baseLimitMax.toLocaleString()} kg`],
  }));

  return (
    <div className="min-w-0 space-y-5 text-sm">
      <section className="space-y-2">
        <h3 className="font-medium">Core Numbers</h3>
        <ul className="list-disc space-y-1 pl-4 text-xs">
          <li>Seasonal buyer slots: base {BASE_SEASONAL_BUYER_COUNT}, max {MAX_SEASONAL_BUYER_COUNT}</li>
          <li>Bulk merchant base reference: {BULK_BASE_SEASON_LIMIT_KG.toLocaleString()} kg; its global-market settlement route has no local seasonal cap.</li>
          <li>Favorite grape bonus: +{FAVORITE_GRAPE_PRIMARY_BONUS.toFixed(2)}× (primary), +{FAVORITE_GRAPE_SECONDARY_BONUS.toFixed(2)}× (secondary)</li>
          <li>Prestige sale bonus cap: +{Math.round(GRAPE_SALE_PRESTIGE_MAX_BONUS * 100)}%</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Relationship Levels</h3>
        <ResponsiveComparisonTable
          label="Grape buyer relationship levels"
          columns={['Level', 'Name', 'Loyalty score threshold', 'Price multiplier', 'Season limit bonus', 'Yearly decay']}
          rows={relationshipRows}
        />
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Relationship Growth Cap Per Year (Scaled by Company Value)</h3>
        <ResponsiveComparisonTable
          label="Yearly relationship growth cap by streak and company value"
          columns={[
            'Consecutive years',
            ...COMPANY_VALUE_SAMPLES.map((value) => `Company value ${formatNumber(value, { currency: true, decimals: 0 })}`),
          ]}
          rows={growthRows}
        />
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Season Demand Modifiers</h3>
        <ResponsiveComparisonTable label="Grape buyer season demand modifiers" columns={['Season', 'Price multiplier', 'Limit multiplier']} rows={seasonRows} />
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Economy Demand Modifiers</h3>
        <ResponsiveComparisonTable label="Grape buyer economy demand modifiers" columns={['Economy phase', 'Price multiplier', 'Limit multiplier']} rows={economyRows} />
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Seasonal Buyer Market Baselines (Before Loyalty/Research)</h3>
        <ResponsiveComparisonTable
          label="Seasonal buyer market baselines by country"
          columns={['Country', 'Multiplier range', 'Base seasonal limit range']}
          rows={baselineRows}
        />
      </section>
    </div>
  );
}
