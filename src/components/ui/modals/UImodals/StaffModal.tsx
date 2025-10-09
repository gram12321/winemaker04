// Staff Modal
// Detailed view for individual staff members

import React from 'react';
import { Staff } from '@/lib/types/types';
import { DialogProps } from '@/lib/types/UItypes';
import { formatCurrency, formatNumber, getFlagIcon, getSpecializationIcon } from '@/lib/utils';
import { getSkillLevelInfo, SPECIALIZED_ROLES } from '@/lib/constants/staffConstants';
import { StaffSkillBarsList } from '@/components/ui/components/StaffSkillBar';
import { Button } from '@/components/ui/shadCN/button';
import { Badge } from '@/components/ui/shadCN/badge';

interface StaffModalProps extends DialogProps {
  staff: Staff | null;
  onFire?: (staffId: string) => void;
}

const StaffModal: React.FC<StaffModalProps> = ({ isOpen, onClose, staff, onFire }) => {
  if (!isOpen || !staff) return null;

  const skillInfo = getSkillLevelInfo(staff.skillLevel);

  const handleFire = () => {
    if (onFire && confirm(`Are you sure you want to fire ${staff.name}?`)) {
      onFire(staff.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className={`${getFlagIcon(staff.nationality)} text-base`}></span>
                  {staff.name}
                </h2>
            <p className="text-sm text-gray-400 mt-1">
              {staff.nationality} • {skillInfo.name} • Hired Week {staff.hireDate.week}, {staff.hireDate.season} {staff.hireDate.year}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Personal Information */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-4">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Nationality:</span>
                  <div className="text-white font-medium flex items-center gap-2 mt-1">
                    <span className={`${getFlagIcon(staff.nationality)} text-base`}></span>
                    {staff.nationality}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Skill Level:</span>
                  <div className="text-white font-medium mt-1">
                    {skillInfo.name} ({formatNumber(staff.skillLevel * 100, { decimals: 0 })}%)
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Employee ID:</span>
                  <div className="text-white font-mono text-xs mt-1">{staff.id.slice(0, 8)}...</div>
                </div>
                <div>
                  <span className="text-gray-400">Workforce:</span>
                  <div className="text-white font-medium mt-1">{staff.workforce} units</div>
                </div>
                {staff.specializations.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-gray-400">Specializations:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {staff.specializations.map(spec => (
                        <Badge key={spec} variant="secondary" className="text-xs bg-blue-600 text-white flex items-center gap-1">
                          <span>{getSpecializationIcon(spec)}</span>
                          <span>{SPECIALIZED_ROLES[spec]?.title || spec}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Skills */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-4">Skills</h3>
              <StaffSkillBarsList staff={staff} />
              <p className="text-xs text-gray-400 mt-3">
                Skills range from 0-100% based on training and experience.
                {staff.specializations.length > 0 && (
                  <span className="block mt-1">
                    Specializations provide bonuses to specific skill areas.
                  </span>
                )}
              </p>
            </div>

            {/* Compensation */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-4">Compensation</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Monthly Wage:</span>
                  <span className="text-white font-medium">{formatCurrency(staff.wage)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Seasonal Wage (12 weeks):</span>
                  <span className="text-white font-medium">{formatCurrency(staff.wage * 12)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Annual Wage (48 weeks):</span>
                  <span className="text-white font-medium">{formatCurrency(staff.wage * 48)}</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Wages are calculated based on skill level and specializations.
                Payments are processed at the start of each season (every 12 weeks).
                {staff.specializations.length > 0 && (
                  <span className="block mt-1">
                    This employee has {staff.specializations.length} specialization{staff.specializations.length > 1 ? 's' : ''}, which increases their base wage.
                  </span>
                )}
              </p>
            </div>

            {/* Employment Details */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-4">Employment Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Hire Date:</span>
                  <div className="text-white font-medium mt-1">
                    Week {staff.hireDate.week}, {staff.hireDate.season} {staff.hireDate.year}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Team Assignment:</span>
                  <div className="text-white font-medium mt-1">
                    {staff.teamId ? `Team ${staff.teamId.slice(0, 8)}...` : 'Unassigned'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-gray-700 text-white hover:bg-gray-600 border-gray-600"
          >
            Close
          </Button>
          {onFire && (
            <Button
              onClick={handleFire}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Fire Employee
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffModal;
