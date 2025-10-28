import React from 'react';
import { Vineyard } from '@/lib/types/types';
import { formatNumber } from '@/lib/utils/utils';
import { TooltipSection, TooltipRow } from '@/components/ui/shadCN/tooltip';

interface HealthTooltipProps {
  vineyard: Vineyard;
}

const HealthTooltip: React.FC<HealthTooltipProps> = ({ vineyard }) => {
  const healthTrend = vineyard.healthTrend;
  
  if (!healthTrend || (healthTrend.seasonalDecay === 0 && healthTrend.plantingImprovement === 0)) {
    return (
      <div className="text-xs">
        <div className="font-medium text-gray-700 mb-1">Vineyard Health: {Math.round(vineyard.vineyardHealth * 100)}%</div>
        <div className="text-gray-500">No significant changes this season</div>
      </div>
    );
  }

  const netChange = healthTrend.netChange;
  const hasPositiveChange = netChange > 0;
  const hasNegativeChange = netChange < 0;

  return (
    <div className="text-xs">
      <div className="font-medium text-gray-700 mb-2">Vineyard Health: {Math.round(vineyard.vineyardHealth * 100)}%</div>
      <TooltipSection title="Health Changes This Season:">
        {healthTrend.seasonalDecay > 0 && (
          <TooltipRow label="Seasonal decay:" value={`-${formatNumber(healthTrend.seasonalDecay * 100, { decimals: 1 })}%`} valueRating={0.1} />
        )}
        {healthTrend.plantingImprovement > 0 && (
          <TooltipRow label="Recent planting:" value={`+${formatNumber(healthTrend.plantingImprovement * 100, { decimals: 1 })}%`} valueRating={0.9} />
        )}
        {(hasPositiveChange || hasNegativeChange) && (
          <TooltipRow label="Net change:" value={`${hasPositiveChange ? '+' : ''}${formatNumber(netChange * 100, { decimals: 1 })}%`} valueRating={hasPositiveChange ? 0.9 : 0.1} />
        )}
      </TooltipSection>
      {vineyard.plantingHealthBonus && vineyard.plantingHealthBonus > 0 && (
        <TooltipSection>
          <div className="text-gray-500">
            Gradual improvement: +{formatNumber(vineyard.plantingHealthBonus * 100, { decimals: 1 })}% remaining
          </div>
        </TooltipSection>
      )}
    </div>
  );
};

export default HealthTooltip;
