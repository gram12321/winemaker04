import React from 'react';
import { formatNumber } from '@/lib/utils/utils';
import { WorkFactor } from '@/lib/services/activity';

interface WorkCalculationTableProps {
  factors: WorkFactor[];
  totalWork: number;
  maxWork?: number; // Add optional maxWork prop
}

export const WorkCalculationTable: React.FC<WorkCalculationTableProps> = ({ factors, totalWork, maxWork }) => {
  const renderModifier = (modifier: number, label?: string) => {
    if (modifier === 0) {
      // Optionally render "0% modifier" if modifier is exactly 0
      return (
        <small className="block text-gray-500 text-xs">
          0% work modifier {label ? `(${label})` : ''}
        </small>
      );
    } 
    const percentage = formatNumber(modifier * 100, { decimals: 0 }); // Format as integer percentage
    const modifierText = modifier > 0 ? 'more' : 'less';
    const colorClass = modifier > 0 ? 'text-red-600' : 'text-green-600'; // Red for more work, green for less
    
    return (
      <small className={`block ${colorClass} text-xs`}>
        {Math.abs(Number(percentage))}% {modifierText} work {label ? `(${label})` : ''}
      </small>
    );
  };

  return (
    <div className="work-calculation-table text-sm">
      {factors.map((factor, index) => (
        <div 
          key={index} 
          className={`flex justify-between py-1 ${factor.isPrimary ? 'font-medium' : 'text-gray-700'} border-b border-gray-100 last:border-b-0`}
        >
          {/* Updated label span to accommodate potentially longer text */}
          <span className="w-1/2 pr-2">{factor.label}:</span> 
          <span className="w-1/2 text-right">
            {typeof factor.value === 'number' ? formatNumber(factor.value, { decimals: 2 }) : factor.value}
            {factor.unit && ` ${factor.unit}`}
            {factor.modifier !== undefined && renderModifier(factor.modifier, factor.modifierLabel)}
          </span>
        </div>
      ))}
      {/* Total Work Row - Display range if maxWork is provided */}
      <div className="flex justify-between py-1 font-bold text-base mt-2 border-t pt-2">
        <span className="w-1/2 pr-2">Total Work:</span>
        <span className="w-1/2 text-right">
          {maxWork && maxWork > totalWork 
            ? `${formatNumber(totalWork, { decimals: 0 })} - ${formatNumber(maxWork, { decimals: 0 })} units` 
            : `${formatNumber(totalWork, { decimals: 0 })} units`}
        </span>
      </div>
    </div>
  );
};

export default WorkCalculationTable;
