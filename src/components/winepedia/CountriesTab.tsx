 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui';
import { CUSTOMER_REGIONAL_DATA } from '@/lib/constants';
import { formatPercent, getColorClass } from '@/lib/utils/utils';

export function CountriesTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Object.entries(CUSTOMER_REGIONAL_DATA).map(([countryName, data]) => (
        <Card key={countryName} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-700 font-bold">{countryName.charAt(0)}</span>
            </div>
            <div>
              <CardTitle className="text-lg">{countryName}</CardTitle>
              <CardDescription>Regional characteristics</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
