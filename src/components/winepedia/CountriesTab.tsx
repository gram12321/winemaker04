 
import { GridCard } from '@/components/ui';
import { CUSTOMER_REGIONAL_DATA } from '@/lib/constants';
import { formatPercent, getColorClass } from '@/lib/utils/utils';

export function CountriesTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(CUSTOMER_REGIONAL_DATA).map(([countryName, data]) => (
          <GridCard 
            key={countryName}
            icon={countryName.charAt(0)}
            title={countryName}
            description="Regional characteristics"
            iconBgColor="bg-green-100"
            iconTextColor="text-green-700"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">Purchasing Power:</span>
                  <span className={`font-bold ${getColorClass(data.purchasingPower)}`}>
                    {formatPercent(data.purchasingPower, 0, true)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">Wine Tradition:</span>
                  <span className={`font-bold ${getColorClass(data.wineTradition)}`}>
                    {formatPercent(data.wineTradition, 0, true)}
                  </span>
                </div>
              </div>
              
              <div className="border-t pt-3">
                <h4 className="font-medium text-gray-700 mb-2">Customer Type Distribution:</h4>
                <div className="space-y-1">
                  {Object.entries(data.customerTypeWeights).map(([type, weight]) => (
                    <div key={type} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{type}:</span>
                      <span className="font-medium">{formatPercent(weight, 0, true)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GridCard>
        ))}
      </div>
    </div>
  );
}
