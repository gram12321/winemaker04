import { useMemo } from 'react';
import { Target } from 'lucide-react';
import {
  FLAVOR_FAMILY_IDS,
  type WineBatch
} from '@/lib/types/types';
import { calculateTasteQualityIndex } from '@/lib/services/wine/taste/tasteQualityIndexService';
import { formatNumber, getColorClass, getQualityCategory } from '@/lib/utils';
import { cn } from '@/lib/utils/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../shadCN/card';
import { TasteBar } from './TasteBar';

export function WineTasteQualityBreakdown({
  batch,
  className
}: {
  batch: WineBatch;
  className?: string;
}) {
  const result = useMemo(() => calculateTasteQualityIndex(batch), [batch]);

  return (
    <Card className={className}>
      <CardHeader className="py-3 pb-2">
        <CardTitle className="text-xs font-medium flex items-center gap-2">
          <Target className="h-4 w-4" /> Taste Quality
        </CardTitle>
      </CardHeader>
      <CardContent className="py-3 pt-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Current Taste Quality:</span>
          <div className="text-right">
            <div className={cn('text-2xl font-bold', getColorClass(result.tasteQualityIndex))}>
              {formatNumber(result.tasteQualityIndex, { decimals: 2, forceDecimals: true })}
            </div>
            <div className="text-sm text-muted-foreground">{getQualityCategory(result.tasteQualityIndex)}</div>
          </div>
        </div>

        <div className="mt-3 space-y-1">
          {FLAVOR_FAMILY_IDS.map((familyId) => {
            const family = result.families[familyId];
            return (
              <TasteBar
                key={familyId}
                familyId={familyId}
                current={family.current}
                ideal={family.ideal}
                acceptedRange={family.acceptedRange}
                score={family.score}
                reasons={family.reasons}
              />
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-2 w-3 rounded bg-emerald-500/60" />
            <span>Adjusted Range</span>
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
      </CardContent>
    </Card>
  );
}
