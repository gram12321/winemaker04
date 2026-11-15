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
      <div className="w-full lg:w-[132px] ml-auto text-right text-[11px] text-gray-400">
        1 {unitLabel}
      </div>
    );
  }

  return (
    <div className="w-full lg:w-[132px] space-y-2 ml-auto">
      <div>
        <Slider
          aria-label={`Quantity in ${unitLabel}`}
          value={[boundedQuantity]}
          min={1}
          max={Math.max(1, maxQuantity)}
          step={1}
          onValueChange={(value) => onQuantityChange(value[0] ?? 1)}
          disabled={disabled || maxQuantity <= 0}
        />
      </div>
      <label className="block text-xs text-gray-400">
        Quantity ({unitLabel})
        <input type="number" inputMode="numeric" key={boundedQuantity} defaultValue={boundedQuantity}
          min={1} max={Math.max(1, maxQuantity)} step={1} disabled={disabled || maxQuantity <= 0}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
          onBlur={(event) => {
            const value = event.currentTarget.valueAsNumber;
            const next = Number.isFinite(value) ? Math.min(Math.max(1, maxQuantity), Math.max(1, Math.round(value))) : boundedQuantity;
            event.currentTarget.value = String(next);
            onQuantityChange(next);
          }}
          className="mt-1 min-h-11 w-full rounded border border-gray-600 bg-gray-900 px-2 py-2 text-base text-white disabled:opacity-50" />
      </label>
      <div className="flex items-center justify-end gap-1">
        <span className="text-[11px] text-gray-400 whitespace-nowrap">{parsedQuantity} {unitLabel}</span>
      </div>
    </div>
  );
};
