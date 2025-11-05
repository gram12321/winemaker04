import React from 'react';
import type { Staff } from '@/lib/types/types';
import { getSkillColor, formatNumber, getColorClass } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, MobileDialogWrapper, TooltipSection, TooltipRow, tooltipStyles } from '../shadCN/tooltip';

interface StaffSkillBarProps {
  label: string;
  skillKey: 'field' | 'winery' | 'administration' | 'sales' | 'maintenance';
  staff: Staff;
  isRelevant?: boolean; // highlight when relevant for current activity
  taskCount?: number; // multitasking count for this staff
  showValue?: boolean;
  className?: string;
}

export const StaffSkillBar: React.FC<StaffSkillBarProps> = ({
  label,
  skillKey,
  staff,
  isRelevant = false,
  taskCount = 1,
  showValue = true,
  className = ''
}) => {
  const value = Math.max(0, Math.min(1, staff.skills[skillKey]));
  const color = getSkillColor(skillKey);
  const effectiveContribution = staff.workforce * value / Math.max(1, taskCount);

  // Build tooltip content JSX
  const buildTooltipContent = () => {
    return (
      <div className={tooltipStyles.text}>
        <TooltipSection title={`${label} Skill Details`}>
          <TooltipRow 
            label={`${label}:`} 
            value={`${formatNumber(value * 100, { decimals: 0 })}%`}
            valueRating={value}
          />
          <TooltipRow 
            label="Workforce:" 
            value={String(staff.workforce)}
          />
          <TooltipRow 
            label="Tasks:" 
            value={String(Math.max(1, taskCount))}
          />
          <TooltipRow 
            label="Contribution:" 
            value={`${formatNumber(effectiveContribution, { decimals: 0 })} / wk`}
            monospaced
          />
          {staff.specializations.includes(skillKey) && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <TooltipRow 
                label="Specialization:" 
                value="+20%"
              />
            </div>
          )}
        </TooltipSection>
      </div>
    );
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-12 text-xs text-gray-600">{label}</div>
      <div className="flex-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild showMobileHint mobileHintVariant="corner-dot">
              <MobileDialogWrapper 
                content={buildTooltipContent()} 
                title={`${label} Skill Details`}
                triggerClassName={`relative w-full h-3 bg-gray-200 rounded-full overflow-hidden cursor-help ${isRelevant ? 'ring-2 ring-yellow-400' : ''}`}
              >
                <div className={`relative w-full h-3 bg-gray-200 rounded-full overflow-hidden cursor-help ${isRelevant ? 'ring-2 ring-yellow-400' : ''}`}>
          {/* Potential multitask overlay: reduce opacity when taskCount > 1 */}
          <div
            className="absolute top-0 bottom-0 rounded-full"
            style={{
              left: 0,
              width: `${formatNumber(value * 100, { decimals: 0 })}%`,
              backgroundColor: color,
              opacity: taskCount > 1 ? 0.85 : 1
            }}
          />
        </div>
              </MobileDialogWrapper>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8} className="max-w-xs" variant="panel" density="compact">
              {buildTooltipContent()}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {showValue && (
        <div className={`w-10 text-right text-xs ${getColorClass(value)}`}>{formatNumber(value * 100, { smartDecimals: true })}%</div>
      )}
    </div>
  );
};

interface StaffSkillBarsListProps {
  staff: Staff;
  relevantSkill?: 'field' | 'winery' | 'administration' | 'sales' | 'maintenance';
  taskCountMap?: Map<string, number>;
  className?: string;
}

export const StaffSkillBarsList: React.FC<StaffSkillBarsListProps> = ({
  staff,
  relevantSkill,
  taskCountMap,
  className = ''
}) => {
  const skills: Array<{ key: StaffSkillBarProps['skillKey']; label: string }> = [
    { key: 'field', label: 'Field' },
    { key: 'winery', label: 'Winery' },
    { key: 'administration', label: 'Admin' },
    { key: 'sales', label: 'Sales' },
    { key: 'maintenance', label: 'Maint.' }
  ];

  return (
    <div className={`space-y-1 ${className}`}>
      {skills.map(s => (
        <StaffSkillBar
          key={s.key}
          label={s.label}
          skillKey={s.key}
          staff={staff}
          isRelevant={relevantSkill === s.key}
          taskCount={taskCountMap?.get(staff.id) || 1}
        />
      ))}
    </div>
  );
};

export default StaffSkillBar;


