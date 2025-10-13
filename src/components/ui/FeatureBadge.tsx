// Generic Feature Badge Component
// Displays wine features (faults and positive traits) with appropriate styling

import { Badge } from './shadCN/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './shadCN/tooltip';
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

// Generate tooltip content for feature badges
function getFeatureTooltipContent(feature: WineFeature, config: FeatureConfig): string {
  if (config.manifestation === 'graduated' && feature.severity > 0) {
    const severityPercent = Math.round(feature.severity * 100);
    
    if (config.id === 'terroir') {
      return `Terroir Expression: ${severityPercent}% developed\n\nThis represents how much vineyard character has developed in this wine:\n• ${severityPercent}% = ${severityPercent < 25 ? 'Early development - subtle characteristics emerging' : severityPercent < 50 ? 'Moderate development - noticeable vineyard influence' : severityPercent < 75 ? 'Strong development - pronounced terroir' : 'Full development - maximum vineyard character'}\n\nTerroir grows over time and affects wine quality and characteristics.`;
    } else if (config.id === 'oxidation') {
      return `Oxidation: ${severityPercent}% developed\n\nThis shows how oxidized the wine has become:\n• ${severityPercent}% = ${severityPercent < 25 ? 'Minor oxidation - barely noticeable' : severityPercent < 50 ? 'Moderate oxidation - some off-flavors' : severityPercent < 75 ? 'Significant oxidation - clearly affected' : 'Severe oxidation - wine may be undrinkable'}\n\nOxidation reduces wine quality and can make it unsellable.`;
    } else if (config.id === 'green_flavor') {
      return `Green Flavor: ${severityPercent}% severity\n\nThis indicates the intensity of green, unripe flavors:\n• ${severityPercent}% = ${severityPercent < 25 ? 'Subtle green notes' : severityPercent < 50 ? 'Noticeable unripe character' : severityPercent < 75 ? 'Strong green flavors' : 'Severe green, harsh taste'}\n\nGreen flavors reduce wine quality and marketability.`;
    } else if (config.id === 'bottle_aging') {
      return `Bottle Aging: ${severityPercent}% developed\n\nThis shows how much complexity and smoothness has developed through aging:\n• ${severityPercent}% = ${severityPercent < 25 ? 'Early development - subtle complexity emerging' : severityPercent < 50 ? 'Moderate aging - noticeable smoothness' : severityPercent < 75 ? 'Well-aged - pronounced complexity' : 'Fully matured - maximum aging benefits'}\n\nAging improves wine quality, characteristics, and increases value.`;
    }
    
    // Generic graduated feature tooltip
    return `${config.name}: ${severityPercent}% severity\n\nThis feature develops over time and affects wine characteristics.`;
  }
  
  // Binary feature tooltip
  return `${config.name}\n\n${config.description}`;
}

export function FeatureBadge({ feature, config, showSeverity = false, className }: FeatureBadgeProps) {
  if (!feature.isPresent) return null;
  
  const variant = getBadgeVariant(config.ui.badgeColor);
  const colorClass = config.ui.badgeColor === 'success' ? 'bg-green-100 text-green-800' : '';
  const tooltipContent = getFeatureTooltipContent(feature, config);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className={`gap-1 cursor-help ${colorClass} ${className || ''}`}>
            <span>{config.icon}</span>
            <span>{config.name}</span>
            {showSeverity && config.manifestation === 'graduated' && feature.severity > 0 && (
              <span className="text-xs opacity-90">
                {Math.round(feature.severity * 100)}%
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs whitespace-pre-line">
            {tooltipContent}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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

