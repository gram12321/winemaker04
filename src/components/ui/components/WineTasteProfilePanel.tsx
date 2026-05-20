import { useMemo } from 'react';
import {
  FLAVOR_FAMILY_IDS,
  FlavorFamilyId,
  WineBatch
} from '@/lib/types/types';
import { computeWineTasteProfile } from '@/lib/services/wine/taste/wineTasteProfileService';
import {
  FLAVOR_FAMILY_LABELS,
  TASTE_DESCRIPTOR_LABELS
} from '@/lib/constants/taste/flavorFamilyLabels';
import { formatNumber } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../shadCN/card';
import { Progress } from '../shadCN/progress';
import { Radio } from 'lucide-react';
import { cn } from '@/lib/utils/utils';
import { WineTasteWheel } from './WineTasteWheel';

function TasteBarRow({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] gap-2">
        <span className="text-muted-foreground truncate" title={label}>
          {label}
        </span>
        <span className="font-mono tabular-nums shrink-0 text-foreground">
          {formatNumber(value, { decimals: 2, forceDecimals: true })}
        </span>
      </div>
      <Progress value={pct} className="h-1.5 bg-muted" />
    </div>
  );
}

export function WineTasteProfilePanel({ batch, className }: { batch: WineBatch; className?: string }) {
  const bundle = useMemo(() => computeWineTasteProfile(batch), [batch]);

  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardHeader className="py-3 pb-2">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <Radio className="h-4 w-4" /> Taste wheel (all variables)
          </CardTitle>
          <p className="text-[11px] text-muted-foreground font-normal leading-relaxed pt-1">
            Radar uses the same normalized values as the family list below. Radius is relative strength (0 center, 1 outer ring).
          </p>
        </CardHeader>
        <CardContent className="py-2 pt-0">
          <WineTasteWheel
            profile={bundle.flavorFamilies}
            descriptorFamilies={bundle.descriptorFamilies}
            descriptors={bundle.descriptors}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-xs font-medium">Flavor families (0-1)</CardTitle>
            <p className="text-[11px] text-muted-foreground font-normal leading-relaxed pt-1">
              Core family layer used for the taste wheel.
            </p>
          </CardHeader>
          <CardContent className="py-3 pt-0 space-y-2 max-h-[28rem] overflow-y-auto scrollbar-styled pr-1">
            {FLAVOR_FAMILY_IDS.map((id) => (
              <TasteBarRow key={id} label={FLAVOR_FAMILY_LABELS[id]} value={bundle.flavorFamilies[id]} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-xs font-medium">Descriptors by family</CardTitle>
            <p className="text-[11px] text-muted-foreground font-normal leading-relaxed pt-1">
              Each descriptor belongs to exactly one family.
            </p>
          </CardHeader>
          <CardContent className="py-3 pt-0 space-y-3 max-h-[28rem] overflow-y-auto scrollbar-styled pr-1">
            {(FLAVOR_FAMILY_IDS as readonly FlavorFamilyId[]).map((familyId) => {
              const descriptorIds = bundle.descriptorFamilies[familyId] || [];
              return (
                <div key={familyId} className="border rounded-md p-2 bg-card/50">
                  <div className="text-[11px] font-medium mb-2">{FLAVOR_FAMILY_LABELS[familyId]}</div>
                  <div className="space-y-2">
                    {descriptorIds.map((descriptorId) => (
                      <TasteBarRow
                        key={descriptorId}
                        label={TASTE_DESCRIPTOR_LABELS[descriptorId]}
                        value={bundle.descriptors[descriptorId]}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed px-0.5">
        Taste values are computed live when this panel opens. They are independent from wine score for now.
      </p>
    </div>
  );
}
