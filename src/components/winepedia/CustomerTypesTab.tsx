 
import { GridCard } from '../ui';
import { SALES_CONSTANTS } from '@/lib/constants';
import { formatPercent } from '@/lib/utils/utils';

export function CustomerTypesTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {Object.entries(SALES_CONSTANTS.CUSTOMER_TYPES).map(([typeName, config]) => (
        <GridCard 
          key={typeName}
          icon={typeName.charAt(0)}
          title={typeName}
          description="Customer type characteristics"
        >
          <div className="space-y-3">
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
          </div>
        </GridCard>
      ))}
    </div>
  );
}
