import { type FlavorFamilyId } from '@/lib/types/types';
import { FLAVOR_FAMILY_LABELS } from '@/lib/constants/taste/flavorFamilyLabels';
import { formatNumber, getColorClass } from '@/lib/utils';
import { cn } from '@/lib/utils/utils';
import { UnifiedTooltip, TooltipRow, TooltipSection, tooltipStyles } from '../shadCN/tooltip';

export interface TasteBarProps {
  familyId: FlavorFamilyId;
  current: number;
  ideal: number;
  acceptedRange: [number, number];
  score: number;
  reasons: string[];
}

/**
 * Displays one taste family using the same marker language as CharacteristicBar:
 * green = accepted range, blue = ideal target, black = current value.
 */
export function TasteBar({
  familyId,
  current,
  ideal,
  acceptedRange,
  score,
  reasons
}: TasteBarProps) {
  const [min, max] = acceptedRange;
  const label = FLAVOR_FAMILY_LABELS[familyId];
  const currentLeft = `${current * 100}%`;
  const idealLeft = `${ideal * 100}%`;
  const rangeLeft = `${min * 100}%`;
  const rangeWidth = `${Math.max(0, (max - min) * 100)}%`;
  const fitPercentage = formatNumber(score * 100, { decimals: 0, forceDecimals: true });
  const rangeSummary = `${formatNumber(min, { decimals: 2, forceDecimals: true })} - ${formatNumber(max, { decimals: 2, forceDecimals: true })}`;

  return (
    <div className="grid grid-cols-[10rem_1fr_3.5rem] items-center gap-3 border-b border-gray-200 py-2 last:border-b-0 text-[11px]">
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground" title={label}>
          {label}
        </div>
      </div>

      <UnifiedTooltip
        content={
          <div className={tooltipStyles.text}>
            <TooltipSection title={`${label} Details`}>
              <TooltipRow label="Current Value:" value={formatNumber(current, { decimals: 2, forceDecimals: true })} valueRating={score} />
              <TooltipRow label="Adjusted Range:" value={rangeSummary} />
              <TooltipRow label="Ideal Target:" value={formatNumber(ideal, { decimals: 2, forceDecimals: true })} />
              <TooltipRow label="Family Fit:" value={`${fitPercentage}%`} valueRating={score} />
              {reasons.length > 1 && (
                <div className="mt-2 border-t border-gray-600 pt-2 text-xs text-gray-300">
                  {reasons.slice(1).join(' ')}
                </div>
              )}
            </TooltipSection>
          </div>
        }
        title={`${label} Details`}
        side="top"
        sideOffset={8}
        className="max-w-sm"
        variant="panel"
        density="compact"
        showMobileHint={true}
        mobileHintVariant="corner-dot"
        triggerClassName="relative h-3 w-full cursor-help overflow-hidden rounded-full bg-gray-200"
      >
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="absolute top-0 bottom-0 rounded-full bg-green-500/60"
            style={{ left: rangeLeft, width: rangeWidth }}
          />
          <div
            className="absolute top-0 bottom-0 z-[5] w-1 -translate-x-1/2 rounded-full bg-blue-700"
            style={{ left: idealLeft }}
          />
          <div
            className="absolute top-0 bottom-0 z-10 w-1 -translate-x-1/2 rounded-full bg-black"
            style={{ left: currentLeft }}
          />
        </div>
      </UnifiedTooltip>

      <div className={cn('text-right font-mono tabular-nums', getColorClass(score))}>
        {formatNumber(current, { decimals: 2, forceDecimals: true })}
      </div>
    </div>
  );
}
