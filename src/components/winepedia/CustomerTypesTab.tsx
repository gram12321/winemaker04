 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui';
import { SALES_CONSTANTS } from '@/lib/constants';
import { formatPercent } from '@/lib/utils/utils';

export function CustomerTypesTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {Object.entries(SALES_CONSTANTS.CUSTOMER_TYPES).map(([typeName, config]) => (
        <Card key={typeName} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-700 font-bold">{typeName.charAt(0)}</span>
            </div>
            <div>
              <CardTitle className="text-lg">{typeName}</CardTitle>
              <CardDescription>Customer type characteristics</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Price Range:</span>
                <p className="text-gray-600">
                  {formatPercent(config.priceMultiplierRange[0], 0, true)} - {formatPercent(config.priceMultiplierRange[1], 0, true)} of base price
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Quantity Range:</span>
                <p className="text-gray-600">
                  {config.quantityRange[0]} - {config.quantityRange[1]} bottles
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Base Multiplier:</span>
                <p className="text-gray-600">{config.baseQuantityMultiplier}x</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Multiple Order Penalty:</span>
                <p className="text-gray-600">{formatPercent(config.multipleOrderPenalty, 0, true)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
