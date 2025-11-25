import React from 'react';
import type { Staff } from '@/lib/types/types';
import { getSkillColor, formatNumber, getColorClass } from '@/lib/utils';
import { calculateEffectiveSkill } from '@/lib/services/user/staffService';
import { UnifiedTooltip, TooltipSection, TooltipRow, tooltipStyles } from '../shadCN/tooltip';

interface StaffSkillBarProps {
  label: string;
  skillKey: 'field' | 'winery' | 'financeAndStaff' | 'sales' | 'administrationAndResearch';
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
  const baseSkill = Math.max(0, Math.min(1, staff.skills[skillKey]));
  const rawXP = staff.experience?.[`skill:${skillKey}`] || 0;
  const effectiveSkill = calculateEffectiveSkill(baseSkill, rawXP);
  const xpBonus = effectiveSkill - baseSkill;

  const color = getSkillColor(skillKey);
  const effectiveContribution = staff.workforce * effectiveSkill / Math.max(1, taskCount);

  // Build tooltip content JSX
  const buildTooltipContent = () => {
    return (
      <div className={tooltipStyles.text}>
        <TooltipSection title={`${label} Skill Details`}>
          <TooltipRow
            label={`Base ${label}:`}
            value={`${formatNumber(baseSkill * 100, { decimals: 0 })}%`}
            valueRating={baseSkill}
          />
          {xpBonus > 0.001 && (
            <TooltipRow
              label="XP Bonus:"
              value={`+${formatNumber(xpBonus * 100, { decimals: 1 })}%`}
              valueRating={xpBonus}
            />
          )}
          <TooltipRow
            label="Effective Skill:"
            value={`${formatNumber(effectiveSkill * 100, { decimals: 1 })}%`}
            valueRating={effectiveSkill}
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
        <UnifiedTooltip
          content={buildTooltipContent()}
          title={`${label} Skill Details`}
          side="top"
          sideOffset={8}
          className="max-w-xs"
          variant="panel"
          density="compact"
          showMobileHint={true}
          mobileHintVariant="corner-dot"
          triggerClassName={`relative w-full h-3 bg-gray-200 rounded-full overflow-hidden cursor-help ${isRelevant ? 'ring-2 ring-yellow-400' : ''}`}
        >
          <div className={`relative w-full h-3 bg-gray-200 rounded-full overflow-hidden cursor-help ${isRelevant ? 'ring-2 ring-yellow-400' : ''}`}>
            {/* Base skill bar - only round left corners if there's XP bonus */}
            <div
              className="absolute top-0 bottom-0"
              style={{
                left: 0,
                width: `${formatNumber(baseSkill * 100, { decimals: 0 })}%`,
                backgroundColor: color,
                opacity: taskCount > 1 ? 0.85 : 1,
                borderRadius: xpBonus > 0.001 ? '9999px 0 0 9999px' : '9999px'
              }}
            />
            {/* XP bonus extension (lighter color) - only round right corners */}
            {xpBonus > 0.001 && (
              <div
                className="absolute top-0 bottom-0"
                style={{
                  left: `${formatNumber(baseSkill * 100, { decimals: 0 })}%`,
                  width: `${formatNumber(xpBonus * 100, { decimals: 0 })}%`,
                  backgroundColor: color,
                  opacity: (taskCount > 1 ? 0.85 : 1) * 0.5, // 50% opacity for XP bonus
                  borderRadius: '0 9999px 9999px 0'
                }}
              />
            )}
          </div>
        </UnifiedTooltip>
      </div>
      {showValue && (
        <div className={`w-10 text-right text-xs ${getColorClass(effectiveSkill)}`}>{formatNumber(effectiveSkill * 100, { smartDecimals: true })}%</div>
      )}
    </div>
  );
};

interface StaffSkillBarsListProps {
  staff: Staff;
  relevantSkill?: 'field' | 'winery' | 'financeAndStaff' | 'sales' | 'administrationAndResearch';
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
    { key: 'financeAndStaff', label: 'Finance' },
    { key: 'sales', label: 'Sales' },
    { key: 'administrationAndResearch', label: 'Admin & Research' }
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


