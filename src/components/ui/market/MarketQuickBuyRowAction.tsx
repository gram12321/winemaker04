import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/shadCN/button';
import { Slider } from '@/components/ui/shadCN/slider';

interface MarketQuickBuyRowActionProps {
  offerId: string;
  maxQuantity: number;
  onBuy: (offerId: string, quantity: number) => Promise<void>;
  disabled?: boolean;
}

export const MarketQuickBuyRowAction: React.FC<MarketQuickBuyRowActionProps> = ({
  offerId,
  maxQuantity,
  onBuy,
  disabled = false,
}) => {
  const [quantity, setQuantity] = useState<number>(Math.min(100, Math.max(1, maxQuantity)));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedQuantity = useMemo(() => Math.max(1, Math.round(quantity)), [quantity]);

  const hasError = parsedQuantity > maxQuantity;

  const handleBuyClick = async () => {
    if (disabled || hasError || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onBuy(offerId, parsedQuantity);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-[132px] space-y-1 ml-auto">
      <div>
        <Slider
          value={[Math.min(parsedQuantity, Math.max(1, maxQuantity))]}
          min={1}
          max={Math.max(1, maxQuantity)}
          step={1}
          onValueChange={(value) => setQuantity(value[0] ?? 1)}
          disabled={disabled || isSubmitting || maxQuantity <= 0}
        />
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] text-gray-400 whitespace-nowrap">{parsedQuantity} kg</span>
        <Button size="sm" className="h-6 px-2 text-[11px]" onClick={handleBuyClick} disabled={disabled || hasError || isSubmitting}>
          {isSubmitting ? '...' : 'Buy'}
        </Button>
      </div>
    </div>
  );
};
