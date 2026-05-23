import React, { useMemo } from 'react';
import { Slider } from '@/components/ui/shadCN/slider';

interface MarketQuickBuyRowActionProps {
  quantity: number;
  maxQuantity: number;
  onQuantityChange: (quantity: number) => void;
  disabled?: boolean;
}

export const MarketQuickBuyRowAction: React.FC<MarketQuickBuyRowActionProps> = ({
  quantity,
  maxQuantity,
  onQuantityChange,
  disabled = false,
}) => {
  const parsedQuantity = useMemo(() => Math.max(1, Math.round(quantity)), [quantity]);

  return (
    <div className="w-[132px] space-y-1 ml-auto">
      <div>
        <Slider
          value={[Math.min(parsedQuantity, Math.max(1, maxQuantity))]}
          min={1}
          max={Math.max(1, maxQuantity)}
          step={1}
          onValueChange={(value) => onQuantityChange(value[0] ?? 1)}
          disabled={disabled || maxQuantity <= 0}
        />
      </div>
      <div className="flex items-center justify-end gap-1">
        <span className="text-[11px] text-gray-400 whitespace-nowrap">{parsedQuantity} kg</span>
      </div>
    </div>
  );
};
