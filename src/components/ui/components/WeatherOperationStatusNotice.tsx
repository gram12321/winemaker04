import { buildWeatherOperationPresentation } from '@/lib/features/weather';
import type { WeatherOperation, WeatherOperationImpact } from '@/lib/features/weather';

interface WeatherOperationStatusNoticeProps {
  operation: WeatherOperation;
  impact: WeatherOperationImpact;
  compact?: boolean;
}

/** Renders an already-resolved operation impact without duplicating weather rules in UI. */
export function WeatherOperationStatusNotice({
  operation,
  impact,
  compact = false,
}: WeatherOperationStatusNoticeProps) {
  const presentation = buildWeatherOperationPresentation(operation, impact);

  if (compact) {
    return (
      <div className="text-xs text-slate-500" role="status">
        <span className="font-medium">{presentation.label}</span> — {impact.reason} {presentation.consequence}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900" role="status">
      <p className="font-semibold">{presentation.label}</p>
      <p className="mt-1">{impact.reason} {presentation.consequence}</p>
      <p className="mt-1 text-xs text-sky-700">{presentation.estimateNote}</p>
    </div>
  );
}
