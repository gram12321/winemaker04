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
    <div className="flex items-center gap-2">
      <div className="min-w-[180px] max-w-[220px]">
        <Slider
          value={[Math.min(parsedQuantity, Math.max(1, maxQuantity))]}
          min={1}
          max={Math.max(1, maxQuantity)}
          step={1}
          onValueChange={(value) => setQuantity(value[0] ?? 1)}
          disabled={disabled || isSubmitting || maxQuantity <= 0}
        />
      </div>
      <span className="text-xs text-gray-600 w-16 text-right">{parsedQuantity} kg</span>
      <Button size="sm" onClick={handleBuyClick} disabled={disabled || hasError || isSubmitting}>
        {isSubmitting ? 'Buying...' : 'Buy'}
      </Button>
    </div>
  );
};
