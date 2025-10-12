// Generic Feature Badge Component
// Displays wine features (faults and positive traits) with appropriate styling

import { Badge } from './shadCN/badge';
import { WineFeature, FeatureConfig } from '@/lib/types/wineFeatures';

interface FeatureBadgeProps {
  feature: WineFeature;
  config: FeatureConfig;
  showSeverity?: boolean;
  className?: string;
}

// Map feature UI colors to ShadCN Badge variants
function getBadgeVariant(badgeColor: FeatureConfig['ui']['badgeColor']): 'default' | 'destructive' | 'outline' | 'secondary' {
  switch (badgeColor) {
    case 'destructive':
      return 'destructive';
    case 'warning':
      return 'outline'; // Use outline for warnings
    case 'info':
      return 'secondary';
    case 'success':
      return 'default'; // Use default (can be styled with className)
    default:
      return 'default';
  }
}

export function FeatureBadge({ feature, config, showSeverity = false, className }: FeatureBadgeProps) {
  if (!feature.isPresent) return null;
  
  const variant = getBadgeVariant(config.ui.badgeColor);
  const colorClass = config.ui.badgeColor === 'success' ? 'bg-green-100 text-green-800' : '';
  
  return (
    <Badge variant={variant} className={`gap-1 ${colorClass} ${className || ''}`}>
      <span>{config.icon}</span>
      <span>{config.name}</span>
      {showSeverity && config.manifestation === 'graduated' && feature.severity > 0 && (
        <span className="text-xs opacity-90">
          {Math.round(feature.severity * 100)}%
        </span>
      )}
    </Badge>
  );
}

/**
 * Display all present features for a wine batch
 * Features are sorted by UI priority (faults first)
 */
interface FeatureBadgesProps {
  features: WineFeature[];
  configs: FeatureConfig[];
  showSeverity?: boolean;
  className?: string;
}

export function FeatureBadges({ features, configs, showSeverity = false, className }: FeatureBadgesProps) {
  const presentFeatures = features
    .filter(f => f.isPresent)
    .map(feature => ({
      feature,
      config: configs.find(c => c.id === feature.id)
    }))
    .filter((item): item is { feature: WineFeature; config: FeatureConfig } => 
      item.config !== undefined
    )
    .sort((a, b) => a.config.ui.sortPriority - b.config.ui.sortPriority);
  
  if (presentFeatures.length === 0) return null;
  
  return (
    <div className={`flex flex-wrap gap-1 ${className || ''}`}>
      {presentFeatures.map(({ feature, config }) => (
        <FeatureBadge
          key={feature.id}
          feature={feature}
          config={config}
          showSeverity={showSeverity}
        />
      ))}
    </div>
  );
}

