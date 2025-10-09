import React from 'react';
import type { Staff } from '@/lib/types/types';
import { getSkillColor, formatNumber } from '@/lib/utils';

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

  const tooltip = [
    `${label}: ${formatNumber(value * 100, { decimals: 0 })}%`,
    `Workforce: ${staff.workforce}`,
    `Tasks: ${Math.max(1, taskCount)}`,
    `Contribution: ${formatNumber(effectiveContribution, { decimals: 0 })} / wk`,
    staff.specializations.includes(skillKey) ? 'Specialization: +20%' : ''
  ].filter(Boolean).join('\n');

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-12 text-xs text-gray-600">{label}</div>
      <div className="flex-1">
        <div className={`relative w-full h-3 bg-gray-200 rounded-full overflow-hidden ${isRelevant ? 'ring-2 ring-yellow-400' : ''}`} title={tooltip}>
          {/* Potential multitask overlay: reduce opacity when taskCount > 1 */}
          <div
            className="absolute top-0 bottom-0 rounded-full"
            style={{
              left: 0,
              width: `${Math.round(value * 100)}%`,
              backgroundColor: color,
              opacity: taskCount > 1 ? 0.85 : 1
            }}
          />
        </div>
      </div>
      {showValue && (
        <div className="w-10 text-right text-xs text-gray-600">{Math.round(value * 100)}%</div>
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


