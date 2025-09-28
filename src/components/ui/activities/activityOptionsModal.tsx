import React, { useCallback } from 'react';
import { WorkFactor, WorkCategory } from '@/lib/services/activity';
import { WorkCalculationTable } from './workCalculationTable';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../shadCN/tooltip';

export type ActivityOptionType = 'number' | 'select' | 'text' | 'range' | 'radio-group';

export interface ActivityOptionField {
  id: string;
  label: string;
  type: ActivityOptionType;
  defaultValue?: string | number | boolean | string[];
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string | number; label: string; description?: string }[];
  tooltip?: string;
  required?: boolean;
}

export interface ActivityWorkEstimate {
  totalWork: number;
  timeEstimate?: string;
}

interface ActivityOptionsModalProps {
  onClose: () => void;
  title: string;
  subtitle?: string;
  category: WorkCategory | string;
  fields: ActivityOptionField[];
  workEstimate: ActivityWorkEstimate;
  workFactors?: WorkFactor[];
  onSubmit: (options: Record<string, any>) => void;
  submitLabel?: string;
  canSubmit?: (options: Record<string, any>) => boolean;
  warningMessage?: string;
  disabledMessage?: string;
  options: Record<string, any>;
  onOptionsChange: (options: Record<string, any>) => void;
  children?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
  maxHeight?: string;
}

/**
 * Generic Activity Options Modal Component
 * Displays options for starting or configuring an activity
 * Generic enough to work with any activity category
 */
export const ActivityOptionsModal: React.FC<ActivityOptionsModalProps> = ({
  onClose,
  title,
  subtitle,
  category,
  fields,
  workEstimate,
  workFactors,
  onSubmit,
  submitLabel = 'Start Activity',
  canSubmit,
  warningMessage,
  disabledMessage = 'Cannot start activity with current options',
  options,
  onOptionsChange,
  children,
  maxWidth = 'lg',
  maxHeight = '90vh'
}) => {
  const handleChange = (id: string, value: any) => {
    onOptionsChange({ ...options, [id]: value });
  };
  
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    // Add the category as a field in the options for reference (like old implementation)
    const optionsWithCategory = { ...options, category };
    
    onSubmit(optionsWithCategory);
  }, [options, category, onSubmit]);
  
  const isSubmitDisabled = canSubmit ? !canSubmit(options) : false;
  
  // Map maxWidth prop to Tailwind classes
  const maxWidthClasses = {
    'sm': 'max-w-sm',
    'md': 'max-w-md', 
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl'
  };

  return (
    <TooltipProvider>
      <div 
        className={`bg-white rounded-lg shadow-lg max-h-[${maxHeight}] overflow-y-auto ${maxWidthClasses[maxWidth]}`}
        style={{ maxHeight }}
      >
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        
        {subtitle && <p className="text-gray-600 mb-6">{subtitle}</p>}
        
        <form onSubmit={handleSubmit}>
          {/* Form Fields */}
          <div className="space-y-4 mb-6">
            {fields.map(field => (
              <div key={field.id} className="relative">
                <div className="flex items-center mb-1">
                  <label htmlFor={field.id} className="block text-sm font-medium text-gray-700">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  
                  {field.tooltip && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-600 text-sm ml-2"
                        >
                          ⓘ
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="whitespace-pre-line text-xs">
                          {field.tooltip}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                
                {field.type === 'text' && (
                  <input
                    type="text"
                    id={field.id}
                    className="w-full p-2 border rounded"
                    value={options[field.id] as string || ''}
                    onChange={e => handleChange(field.id, e.target.value)}
                    required={field.required}
                  />
                )}
                
                {field.type === 'number' && (
                  <input
                    type="number"
                    id={field.id}
                    className="w-full p-2 border rounded"
                    value={options[field.id] as number || ''}
                    onChange={e => handleChange(field.id, parseFloat(e.target.value))}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    required={field.required}
                  />
                )}
                
                {field.type === 'select' && field.options && (
                  <select
                    id={field.id}
                    className="w-full p-2 border rounded"
                    value={options[field.id] as string | number || ''}
                    onChange={e => handleChange(field.id, e.target.value)}
                    required={field.required}
                  >
                    {field.options.map(option => (
                      <option key={option.value.toString()} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
                
                {field.type === 'range' && (
                  <div>
                    <input
                      type="range"
                      id={field.id}
                      className="w-full"
                      value={options[field.id] as number || field.min || 0}
                      onChange={e => handleChange(field.id, parseFloat(e.target.value))}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{field.min}</span>
                      <span className="font-medium">{options[field.id] || field.min}</span>
                      <span>{field.max}</span>
                    </div>
                  </div>
                )}
                
                {field.type === 'radio-group' && field.options && (
                  <div className="space-y-2 mt-1">
                    {field.options.map(option => (
                      <div key={option.value} className="flex items-center">
                        <input
                          type="radio"
                          id={`${field.id}-${option.value}`}
                          name={field.id}
                          value={option.value}
                          checked={options[field.id] === option.value}
                          onChange={e => handleChange(field.id, e.target.value)}
                          className="mr-2 h-4 w-4 rounded border-gray-300 text-wine focus:ring-wine"
                        />
                        <label htmlFor={`${field.id}-${option.value}`} className="text-sm text-gray-700">
                          {option.label}
                          {option.description && <span className="text-xs text-gray-500 ml-1">({option.description})</span>}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Work Estimate Section */}
          <div className="bg-gray-50 p-4 rounded mb-4">
            <h3 className="font-medium mb-2">Work Estimate</h3>
            {workFactors ? (
              <WorkCalculationTable factors={workFactors} totalWork={workEstimate.totalWork} />
            ) : (
              <p className="text-sm text-gray-600">Calculating work factors...</p> 
            )}
          </div>
          
          {/* Custom Children */}
          {children}
          
          {/* Warning Message */}
          {warningMessage && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded mb-4">
              {warningMessage}
            </div>
          )}
          
          <div className="mt-6 flex justify-end space-x-2">
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 rounded shadow-sm text-gray-700 bg-white hover:bg-gray-50"
              onClick={onClose}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              className={`px-4 py-2 rounded shadow-sm text-white ${
                isSubmitDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-wine hover:bg-wine-dark'
              }`}
              disabled={isSubmitDisabled}
              title={isSubmitDisabled ? disabledMessage : ''}
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
      </div>
    </TooltipProvider>
  );
};

export default ActivityOptionsModal;
