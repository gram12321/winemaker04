import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui';
import { formatCurrency } from '@/lib/utils/utils';
import { getTotalWeeklyWages, getTotalSeasonalWages, getTotalYearlyWages, getAllStaff } from '@/lib/services';
import { useGameStateWithData } from '@/hooks';
import { Users } from 'lucide-react';

export function StaffWageSummary() {
  const staff = useGameStateWithData(() => Promise.resolve(getAllStaff()), []);
  
  const weeklyWages = getTotalWeeklyWages();
  const seasonalWages = getTotalSeasonalWages();
  const yearlyWages = getTotalYearlyWages();
  
  if (staff.length === 0) {
    return null; // Don't show if no staff
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff Wage Overview</CardTitle>
        <CardDescription>Summary of current staff wage expenses</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
        {/* Staff count */}
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-md border border-blue-200">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Total Staff</span>
          </div>
          <span className="text-lg font-bold text-blue-600">{staff.length}</span>
        </div>
        
        {/* Wage breakdown */}
        <div className="border border-gray-300 rounded-md p-4 space-y-3">
          <h4 className="font-semibold text-gray-800 text-sm uppercase tracking-wider">Wage Expenses</h4>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Per Week</span>
              <span className="font-medium text-gray-900">{formatCurrency(weeklyWages)}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Per Season (12 weeks)</span>
              <span className="font-medium text-gray-900">{formatCurrency(seasonalWages)}</span>
            </div>
            
            <hr className="border-gray-300" />
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-700 font-medium">Per Year (4 seasons)</span>
              <span className="font-bold text-gray-900">{formatCurrency(yearlyWages)}</span>
            </div>
          </div>
        </div>
        
        {/* Payment schedule info */}
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
          <p className="text-xs text-amber-800">
            💰 Wages are paid seasonally at the start of each season (Week 1 of Spring, Summer, Fall, Winter)
          </p>
        </div>
        
        {/* Staff list */}
        <div className="border border-gray-300 rounded-md p-4">
          <h4 className="font-semibold text-gray-800 text-sm uppercase tracking-wider mb-3">Staff Members</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {staff.map((member) => (
              <div key={member.id} className="flex justify-between items-center text-sm py-2 border-b border-gray-200 last:border-0">
                <div>
                  <div className="font-medium text-gray-900">{member.name}</div>
                  <div className="text-xs text-gray-500">{member.nationality}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900">{formatCurrency(member.wage)}/wk</div>
                  <div className="text-xs text-gray-500">{formatCurrency(member.wage * 12)}/season</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>
      </CardContent>
    </Card>
  );
}

