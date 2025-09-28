// Shared characteristic slider component for winepedia
import { Tooltip, TooltipContent, TooltipTrigger } from '../shadCN/tooltip';
import { CharacteristicSliderProps } from '@/lib/utils';

interface CharacteristicSliderComponentProps extends CharacteristicSliderProps {
  className?: string;
}

export function CharacteristicSlider({ 
  value, 
  onChange, 
  label, 
  icon, 
  className = "" 
}: Omit<CharacteristicSliderComponentProps, 'key'>) {
  return (
    <div className={`flex items-center gap-3 py-1 ${className}`}>
      <div className="w-24 flex items-center gap-2 text-xs">
        <Tooltip>
          <TooltipTrigger asChild>
            <img 
              src={icon} 
              alt={`${label} icon`} 
              className="w-4 h-4 opacity-80 cursor-help"
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
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
          <span className="font-medium">{value.toFixed(2)}</span>
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
