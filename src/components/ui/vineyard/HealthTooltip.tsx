import React from 'react';
import { Vineyard } from '@/lib/types/types';
import { formatNumber } from '@/lib/utils/utils';

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
      
      <div className="space-y-1">
        <div className="font-medium text-gray-600 mb-1">Health Changes This Season:</div>
        
        {healthTrend.seasonalDecay > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Seasonal decay:</span>
            <span className="text-red-600 font-medium">
              -{formatNumber(healthTrend.seasonalDecay * 100, { decimals: 1 })}%
            </span>
          </div>
        )}
        
        {healthTrend.plantingImprovement > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Recent planting:</span>
            <span className="text-green-600 font-medium">
              +{formatNumber(healthTrend.plantingImprovement * 100, { decimals: 1 })}%
            </span>
          </div>
        )}
        
        {(hasPositiveChange || hasNegativeChange) && (
          <div className="flex justify-between items-center pt-1 border-t border-gray-200">
            <span className="font-medium text-gray-700">Net change:</span>
            <span className={`font-medium ${hasPositiveChange ? 'text-green-600' : 'text-red-600'}`}>
              {hasPositiveChange ? '+' : ''}{formatNumber(netChange * 100, { decimals: 1 })}%
            </span>
          </div>
        )}
      </div>
      
      {vineyard.plantingHealthBonus && vineyard.plantingHealthBonus > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="text-gray-500">
            Gradual improvement: +{formatNumber(vineyard.plantingHealthBonus * 100, { decimals: 1 })}% remaining
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthTooltip;
