// Staff Management Page
// Main page for viewing and managing staff members

import React, { useState } from 'react';
import { useGameState } from '@/hooks';
import { getAllStaff, removeStaff } from '@/lib/services';
import type { Staff } from '@/lib/types/types';
import { formatCurrency } from '@/lib/utils';
import { getSkillLevelInfo } from '@/lib/constants/staffConstants';
import { Button } from '@/components/ui/shadCN/button';
import { Badge } from '@/components/ui/shadCN/badge';
import { HireStaffModal } from '@/components/ui/modals/UImodals/HireStaffModal';
import { StaffSkillBarsList } from '@/components/ui/components/StaffSkillBar';
import { Users } from 'lucide-react';

interface StaffPageProps {
  title: string;
}

/**
 * Staff Management Page
 * Displays all staff members with their skills, wages, and management options
 */
export const StaffPage: React.FC<StaffPageProps> = ({ title }) => {
  useGameState(); // Subscribe to game state updates for reactivity
  const [showHireModal, setShowHireModal] = useState(false);
  
  const allStaff = getAllStaff();
  const totalWages = allStaff.reduce((sum, staff) => sum + staff.wage, 0);
  
  const handleFireStaff = async (staffId: string) => {
    const staff = allStaff.find(s => s.id === staffId);
    if (!staff) return;
    
    if (confirm(`Are you sure you want to fire ${staff.name}?`)) {
      await removeStaff(staffId);
    }
  };
  
  // Render skill bars for a staff member
  const renderSkillBars = (staff: Staff) => (
    <StaffSkillBarsList staff={staff} />
  );
  
  return (
    <div className="space-y-3 text-sm">
      {/* Banner */}
      <div 
        className="h-28 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-indigo-900 to-transparent p-2.5">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-white text-base font-semibold flex items-center gap-2">
                <span className="text-base">👥</span>
                Staff Management
              </h2>
              <p className="text-white/90 text-xs mt-0.5">Manage your winery staff</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-base font-semibold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-600 mt-0.5">Manage your winery staff</p>
        </div>
        <Button
          onClick={() => setShowHireModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Users className="mr-2 h-4 w-4" />
          Hire Staff
        </Button>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg shadow p-3">
          <div className="text-xs text-gray-600 mb-1">Total Staff</div>
          <div className="text-xl font-bold text-gray-900">{allStaff.length}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-3">
          <div className="text-xs text-gray-600 mb-1">Total Monthly Wages</div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(totalWages)}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-3">
          <div className="text-xs text-gray-600 mb-1">Average Wage</div>
          <div className="text-xl font-bold text-gray-900">
            {allStaff.length > 0 ? formatCurrency(totalWages / allStaff.length) : '€0'}
          </div>
        </div>
      </div>
      
      {/* Staff List */}
      {allStaff.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-gray-900 mb-1">No Staff Members</h3>
          <p className="text-xs text-gray-600 mb-4">You haven't hired any staff yet.</p>
          <Button
            onClick={() => setShowHireModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Hire Your First Employee
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
            {allStaff.map(staff => {
              const skillInfo = getSkillLevelInfo(staff.skillLevel);
              
              return (
                <div
                  key={staff.id}
                  className="bg-white rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{staff.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-600">{staff.nationality}</span>
                        <Badge variant="outline" className="text-2xs">
                          {skillInfo.name}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFireStaff(staff.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Fire
                    </Button>
                  </div>
                  
                  {/* Skills */}
                  <div className="mb-2">
                    {renderSkillBars(staff)}
                  </div>
                  
                  {/* Footer */}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">Wage:</span> {formatCurrency(staff.wage)}/mo
                      </div>
                      <div>
                        <span className="font-medium">Workforce:</span> {staff.workforce}
                      </div>
                    </div>
                    
                    {staff.specializations.length > 0 && (
                      <div className="flex gap-1">
                        {staff.specializations.map(spec => (
                          <Badge key={spec} variant="secondary" className="text-2xs">
                            {spec}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Hire Date */}
                  <div className="text-2xs text-gray-500 mt-1">
                    Hired: Week {staff.hireDate.week}, {staff.hireDate.season} {staff.hireDate.year}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Hire Staff Modal */}
      {showHireModal && (
        <HireStaffModal
          isOpen={showHireModal}
          onClose={() => setShowHireModal(false)}
        />
      )}
    </div>
  );
};

