import { useMemo } from 'react';
import { Target } from 'lucide-react';
import {
  FLAVOR_FAMILY_IDS,
  type FlavorFamilyId,
  type WineBatch
} from '@/lib/types/types';
import { calculateTasteQualityIndex } from '@/lib/services/wine/taste/tasteQualityIndexService';
import { FLAVOR_FAMILY_LABELS } from '@/lib/constants/taste/flavorFamilyLabels';
import { formatNumber, getColorClass, getQualityCategory } from '@/lib/utils';
import { cn } from '@/lib/utils/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../shadCN/card';

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function FamilyRangeRow({
  familyId,
  current,
  ideal,
  acceptedRange,
  score
}: {
  familyId: FlavorFamilyId;
  current: number;
  ideal: number;
  acceptedRange: [number, number];
  score: number;
}) {
  const [min, max] = acceptedRange;
  const currentLeft = `${current * 100}%`;
  const idealLeft = `${ideal * 100}%`;
  const rangeLeft = `${min * 100}%`;
  const rangeWidth = `${Math.max(0, (max - min) * 100)}%`;

  return (
    <div className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3 text-[11px]">
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground" title={FLAVOR_FAMILY_LABELS[familyId]}>
          {FLAVOR_FAMILY_LABELS[familyId]}
        </div>
        <div className="font-mono text-muted-foreground">
          {formatNumber(current, { decimals: 2, forceDecimals: true })}
        </div>
      </div>

      <div className="relative h-5">
        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-muted" />
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-emerald-500/55"
          style={{ left: rangeLeft, width: rangeWidth }}
        />
        <div
          className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-blue-700"
          style={{ left: idealLeft }}
          title={`Ideal ${pct(ideal)}`}
        />
        <div
          className="absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-black"
          style={{ left: currentLeft }}
          title={`Current ${pct(current)}`}
        />
      </div>

      <div className={cn('text-right font-mono tabular-nums', getColorClass(score))}>
        {formatNumber(score * 100, { decimals: 0, forceDecimals: true })}%
      </div>
    </div>
  );
}

export function WineTasteQualityBreakdown({
  batch,
  className
}: {
  batch: WineBatch;
  className?: string;
}) {
  const result = useMemo(() => calculateTasteQualityIndex(batch), [batch]);
  const weakestFamilies = useMemo(
    () =>
      [...FLAVOR_FAMILY_IDS]
        .map((familyId) => ({ familyId, breakdown: result.families[familyId] }))
        .sort((a, b) => a.breakdown.score - b.breakdown.score)
        .slice(0, 4),
    [result]
  );

  return (
    <Card className={className}>
      <CardHeader className="py-3 pb-2">
        <CardTitle className="text-xs font-medium flex items-center gap-2">
          <Target className="h-4 w-4" /> Taste Quality
        </CardTitle>
      </CardHeader>
      <CardContent className="py-3 pt-0 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Current Taste Quality:</span>
          <div className="text-right">
            <div className={cn('text-2xl font-bold', getColorClass(result.tasteQualityIndex))}>
              {formatNumber(result.tasteQualityIndex, { decimals: 2, forceDecimals: true })}
            </div>
            <div className="text-sm text-gray-600">{getQualityCategory(result.tasteQualityIndex)}</div>
          </div>
        </div>

        <div className="space-y-2">
          {FLAVOR_FAMILY_IDS.map((familyId) => {
            const family = result.families[familyId];
            return (
              <FamilyRangeRow
                key={familyId}
                familyId={familyId}
                current={family.current}
                ideal={family.ideal}
                acceptedRange={family.acceptedRange}
                score={family.score}
              />
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="h-2 w-3 rounded bg-emerald-500/60" />
            <span>Accepted Range</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-0.5 rounded bg-black" />
            <span>Current Value</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-0.5 rounded bg-blue-700" />
            <span>Ideal Target</span>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="mb-2 text-[11px] font-medium text-muted-foreground">Lowest family fits</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {weakestFamilies.map(({ familyId, breakdown }) => (
              <div key={familyId} className="rounded-md border bg-card/50 p-2 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{FLAVOR_FAMILY_LABELS[familyId]}</span>
                  <span className={cn('font-mono tabular-nums', getColorClass(breakdown.score))}>
                    {formatNumber(breakdown.score * 100, { decimals: 0, forceDecimals: true })}%
                  </span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  Current {pct(breakdown.current)} / range {pct(breakdown.acceptedRange[0])}-{pct(breakdown.acceptedRange[1])}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
