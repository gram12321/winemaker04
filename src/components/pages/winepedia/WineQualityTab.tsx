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
        description="What influences land value modifier and taste index in your winery"
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
              <h4 className="font-semibold text-gray-800 mb-3">Taste Index (Dynamic)</h4>
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
    </div>
  );
}

