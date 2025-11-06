// Shared characteristic slider component for winepedia
import { UnifiedTooltip, TooltipSection, TooltipRow, tooltipStyles } from '../shadCN/tooltip';
import { getRatingForRange } from '@/lib/utils/utils';
import { BASE_BALANCED_RANGES } from '@/lib/constants/grapeConstants';
import { WineCharacteristics } from '@/lib/types/types';
import { formatNumber } from '@/lib/utils';

interface CharacteristicSliderProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  icon: string;
  className?: string;
}

export function CharacteristicSlider({ 
  value, 
  onChange, 
  label, 
  icon, 
  className = "" 
}: CharacteristicSliderProps) {
  return (
    <div className={`flex items-center gap-3 py-1 ${className}`}>
      <div className="w-24 flex items-center gap-2 text-xs">
        <UnifiedTooltip
          content={
            <div className={tooltipStyles.text}>
              <TooltipSection title={`${label} Information`}>
                <TooltipRow label="Characteristic:" value={label} />
                <TooltipRow 
                  label="Current Value:" 
                  value={formatNumber(value, { smartDecimals: true })}
                  valueRating={(() => {
                    const charKey = label.toLowerCase() as keyof WineCharacteristics;
                    const balancedRange = BASE_BALANCED_RANGES[charKey];
                    if (balancedRange) {
                      return getRatingForRange(value, 0, 1, 'balanced', balancedRange[0], balancedRange[1]);
                    }
                    return getRatingForRange(value, 0, 1, 'higher_better');
                  })()}
                  monospaced
                />
              </TooltipSection>
            </div>
          }
          title={`${label} Information`}
          side="top"
          sideOffset={8}
          className="max-w-xs"
          variant="panel"
          density="compact"
          triggerClassName="cursor-help"
        >
          <img src={icon} alt={`${label} icon`} className="w-4 h-4 opacity-80 cursor-help" />
        </UnifiedTooltip>
        <span className="font-medium capitalize">{label}</span>
      </div>
      <div className="flex-1">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
          <span>0.00</span>
          <span className="font-medium">{formatNumber(value, { smartDecimals: true })}</span>
          <span>1.00</span>
        </div>
      </div>
    </div>
  );
}

interface CharacteristicSliderGridProps {
  characteristics: Record<string, number> | import('@/lib/types/types').WineCharacteristics;
  onChange: (key: string, value: number) => void;
  className?: string;
}

export function CharacteristicSliderGrid({ 
  characteristics, 
  onChange, 
  className = "" 
}: CharacteristicSliderGridProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Object.entries(characteristics).map(([key, value]) => (
        <CharacteristicSlider
          key={key}
          value={value}
          onChange={(newValue) => onChange(key, newValue)}
          label={key.charAt(0).toUpperCase() + key.slice(1)}
          icon={`/assets/icons/characteristics/${key}.png`}
        />
      ))}
    </div>
  );
}
