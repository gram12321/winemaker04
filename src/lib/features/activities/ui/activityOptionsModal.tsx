import React, { useCallback } from 'react';
import type { WorkCategory } from '@/lib/types/types';
import type { WorkFactor } from '../services/workcalculators/workCalculator';
import { WorkCalculationTable } from './workCalculationTable';
import { UnifiedTooltip } from '@/components/ui/shadCN/tooltip';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/shadCN/dialog';

export type ActivityOptionType = 'number' | 'select' | 'text' | 'range' | 'radio-group' | 'checkbox-group';

export interface ActivityOptionField {
  id: string;
  label: string;
  type: ActivityOptionType;
  defaultValue?: string | number | boolean | string[];
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string | number; label: string; description?: string; disabled?: boolean }[];
  checkboxOptions?: { value: string; label: string; description?: string }[];
  tooltip?: string;
  required?: boolean;
}

export interface ActivityWorkEstimate {
  totalWork: number;
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        onPointerDownOutside={(event) => event.preventDefault()}
        className={`flex w-[calc(100%-1rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 ${maxWidthClasses[maxWidth]}`}
        style={{ maxHeight: `min(${maxHeight}, calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 1rem))` }}
      >
        <div className="shrink-0 border-b p-4 pr-16 md:p-6 md:pr-16">
          <DialogTitle className="text-lg md:text-xl font-bold break-words">{title}</DialogTitle>
          {subtitle && <DialogDescription className="text-sm text-gray-600 mt-2">{subtitle}</DialogDescription>}
        </div>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 scrollbar-styled">
          {/* Form Fields */}
          <div className="space-y-4 mb-6">
            {fields.map(field => (
              <div key={field.id} className="relative">
                <div className="flex items-center mb-1">
                  <label htmlFor={field.id} className="block text-sm font-medium text-gray-700">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  
                  {field.tooltip && (
                    <UnifiedTooltip
                      content={
                        <div className="whitespace-pre-line text-xs">
                          {field.tooltip}
                        </div>
                      }
                      title={`${field.label} Info`}
                      side="top"
                      sideOffset={4}
                      className="max-w-xs"
                      variant="panel"
                      density="compact"
                    >
                      <button
                        type="button"
                        aria-label={`${field.label} information`}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center text-gray-500 hover:text-gray-700 text-sm ml-1"
                      >
                        ⓘ
                      </button>
                    </UnifiedTooltip>
                  )}
                </div>
                
                {field.type === 'text' && (
                  <input
                    type="text"
                    id={field.id}
                    className="min-h-11 w-full min-w-0 p-2 text-base border rounded"
                    value={options[field.id] as string || ''}
                    onChange={e => handleChange(field.id, e.target.value)}
                    required={field.required}
                  />
                )}
                
                {field.type === 'number' && (
                  <input
                    type="number"
                    id={field.id}
                    className="min-h-11 w-full min-w-0 p-2 text-base border rounded"
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
                    className="min-h-11 w-full min-w-0 p-2 text-base border rounded"
                    value={options[field.id] as string | number || ''}
                    onChange={e => handleChange(field.id, e.target.value)}
                    required={field.required}
                  >
                    {field.options.map(option => (
                      <option key={option.value.toString()} value={option.value} disabled={option.disabled}>
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
                      className="min-h-11 w-full"
                      value={options[field.id] as number || field.min || 0}
                      onChange={e => handleChange(field.id, parseFloat(e.target.value))}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                    />
                    <input
                      type="number"
                      aria-label={`${field.label} precise value`}
                      className="mt-1 min-h-11 w-full rounded border p-2 text-base"
                      value={options[field.id] ?? field.min ?? 0}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      onChange={event => {
                        const value = event.target.valueAsNumber;
                        if (event.target.validity.valid && Number.isFinite(value)) handleChange(field.id, value);
                      }}
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
                      <div key={option.value} className="flex min-h-11 items-center">
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
                
                {field.type === 'checkbox-group' && field.checkboxOptions && (
                  <div className="space-y-2 mt-1">
                    {field.checkboxOptions.map(option => (
                      <label key={option.value} className="flex min-h-11 items-start cursor-pointer gap-1">
                        <input
                          type="checkbox"
                          id={`${field.id}-${option.value}`}
                          checked={(options[field.id] as string[] || []).includes(option.value)}
                          onChange={e => {
                            const currentValues = (options[field.id] as string[]) || [];
                            const newValues = e.target.checked
                              ? [...currentValues, option.value]
                              : currentValues.filter(v => v !== option.value);
                            handleChange(field.id, newValues);
                          }}
                          className="mr-2 mt-1 h-4 w-4 rounded border-gray-300 text-wine focus:ring-wine"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-700">{option.label}</div>
                          {option.description && (
                            <div className="text-xs text-gray-500 mt-0.5">{option.description}</div>
                          )}
                        </div>
                      </label>
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
          
          </div>
          <div className="shrink-0 border-t bg-white p-4 md:px-6">
            {isSubmitDisabled && <p className="mb-3 text-sm text-amber-800" role="status">{disabledMessage}</p>}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end [&_button]:min-h-11 [&_button]:whitespace-normal">
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 rounded shadow-sm text-gray-700 bg-white hover:bg-gray-50"
              onClick={onClose}
            >
              Cancel
            </button>
            
            {isSubmitDisabled ? (
              <UnifiedTooltip
                title="Activity unavailable"
                content={<p className="text-xs text-gray-200">{disabledMessage}</p>}
                variant="panel"
                density="compact"
              >
                <span className="inline-block w-full sm:w-auto">
                  <button
                    type="submit"
                    className="w-full px-4 py-2 rounded shadow-sm text-white bg-gray-400 cursor-not-allowed"
                    disabled
                  >
                    {submitLabel}
                  </button>
                </span>
              </UnifiedTooltip>
            ) : (
            <button
              type="submit"
              className="px-4 py-2 rounded shadow-sm text-white bg-wine hover:bg-wine-dark"
            >
              {submitLabel}
            </button>
            )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ActivityOptionsModal;
