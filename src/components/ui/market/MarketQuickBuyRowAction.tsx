import React, { useMemo } from 'react';
import { Slider } from '@/components/ui/shadCN/slider';

interface MarketQuickBuyRowActionProps {
  quantity: number;
  maxQuantity: number;
  onQuantityChange: (quantity: number) => void;
  disabled?: boolean;
  unitLabel?: string;
}

export const MarketQuickBuyRowAction: React.FC<MarketQuickBuyRowActionProps> = ({
  quantity,
  maxQuantity,
  onQuantityChange,
  disabled = false,
  unitLabel = 'kg',
}) => {
  const parsedQuantity = useMemo(() => Math.max(1, Math.round(quantity)), [quantity]);
  const boundedQuantity = Math.min(parsedQuantity, Math.max(1, maxQuantity));

  if (maxQuantity <= 1) {
    return (
      <div className="w-[132px] ml-auto text-right text-[11px] text-gray-400">
        1 {unitLabel}
      </div>
    );
  }

  return (
    <div className="w-[132px] space-y-1 ml-auto">
      <div>
        <Slider
          value={[boundedQuantity]}
          min={1}
          max={Math.max(1, maxQuantity)}
          step={1}
          onValueChange={(value) => onQuantityChange(value[0] ?? 1)}
          disabled={disabled || maxQuantity <= 0}
        />
      </div>
      <div className="flex items-center justify-end gap-1">
        <span className="text-[11px] text-gray-400 whitespace-nowrap">{parsedQuantity} {unitLabel}</span>
      </div>
    </div>
  );
};
