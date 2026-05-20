import {
  FLAVOR_FAMILY_IDS,
  type FlavorFamilyId,
  type WineFlavorFamilyProfile,
  type WineTasteDescriptorId,
  type WineTasteDescriptorProfile
} from '@/lib/types/types';
import { FLAVOR_FAMILY_WHEEL_LABELS, TASTE_DESCRIPTOR_LABELS } from '@/lib/constants/taste/flavorFamilyLabels';
import { cn } from '@/lib/utils/utils';

const CX = 140;
const CY = 140;
const R_MAX = 92;
const R_LABEL = 112;

/**
 * Wine Folly–style 14-family radar for the Taste tab (computed profile, not persisted).
 */
export function WineTasteWheel({
  profile,
  descriptorFamilies,
  descriptors,
  className
}: {
  profile: WineFlavorFamilyProfile;
  descriptorFamilies?: Record<FlavorFamilyId, WineTasteDescriptorId[]>;
  descriptors?: WineTasteDescriptorProfile;
  className?: string;
}) {
  const n = FLAVOR_FAMILY_IDS.length;

  const spokes = FLAVOR_FAMILY_IDS.map((id, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return {
      id,
      angle,
      x2: CX + R_MAX * Math.cos(angle),
      y2: CY + R_MAX * Math.sin(angle),
      lx: CX + R_LABEL * Math.cos(angle),
      ly: CY + R_LABEL * Math.sin(angle),
      label: FLAVOR_FAMILY_WHEEL_LABELS[id],
      topDescriptor: (() => {
        if (!descriptorFamilies || !descriptors) return '';
        const familyDescriptors = descriptorFamilies[id] || [];
        if (familyDescriptors.length === 0) return '';
        const top = [...familyDescriptors]
          .sort((a, b) => (descriptors[b] ?? 0) - (descriptors[a] ?? 0))[0];
        return top ? TASTE_DESCRIPTOR_LABELS[top] : '';
      })()
    };
  });

  const polygonPoints = FLAVOR_FAMILY_IDS.map((id, i) => {
    const { angle } = spokes[i];
    const r = R_MAX * profile[id];
    return `${CX + r * Math.cos(angle)},${CY + r * Math.sin(angle)}`;
  }).join(' ');

  return (
    <div className={cn('flex justify-center py-1', className)} role="img" aria-label="Flavor family radar chart">
      <svg
        width={280}
        height={280}
        viewBox="0 0 280 280"
        className="max-w-full h-auto text-foreground"
      >
        <defs>
          <linearGradient id="wineTasteWheelFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.32} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((t) => (
          <circle
            key={t}
            cx={CX}
            cy={CY}
            r={R_MAX * t}
            fill="none"
            className="stroke-border"
            strokeWidth={0.5}
            opacity={0.55}
          />
        ))}

        {spokes.map((s) => (
          <line
            key={s.id}
            x1={CX}
            y1={CY}
            x2={s.x2}
            y2={s.y2}
            className="stroke-border"
            strokeWidth={0.65}
            opacity={0.45}
          />
        ))}

        <polygon
          points={polygonPoints}
          fill="url(#wineTasteWheelFill)"
          className="stroke-primary"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />

        {spokes.map((s) => {
          const cos = Math.cos(s.angle);
          const sin = Math.sin(s.angle);
          const textAnchor = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
          const dy = sin > 0.3 ? 3 : sin < -0.3 ? -2 : 0;
          return (
            <text
              key={`lbl-${s.id}`}
              x={s.lx}
              y={s.ly + dy}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              className="fill-muted-foreground text-[8.5px] font-medium"
            >
              <tspan x={s.lx} dy="0">{s.label}</tspan>
              {s.topDescriptor ? (
                <tspan x={s.lx} dy="8" className="text-[7px] opacity-75">
                  {s.topDescriptor}
                </tspan>
              ) : null}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
