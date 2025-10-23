import React, { useState, useEffect } from 'react';
import { LenderSearchOptions, LenderType } from '@/lib/types/types';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/shadCN/button';
import { X } from 'lucide-react';
import { getGameState } from '@/lib/services';
import { calculateLenderSearchCost, calculateLenderSearchWork } from '@/lib/services';

interface LenderSearchOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchStarted?: () => void;
}

const LENDER_TYPES: LenderType[] = ['Bank', 'Investment Fund', 'Private Lender'];

export const LenderSearchOptionsModal: React.FC<LenderSearchOptionsModalProps> = ({
  isOpen,
  onClose,
  onSearchStarted
}) => {
  const [options, setOptions] = useState<LenderSearchOptions>({
    numberOfOffers: 10,
    lenderTypes: LENDER_TYPES, // All types selected by default
    searchCost: 0,
    searchWork: 0
  });

  // Preview calculations for search
  const [previewStats, setPreviewStats] = useState<{
    totalCost: number;
    totalWork: number;
    timeEstimate: string;
  }>({
    totalCost: 0,
    totalWork: 0,
    timeEstimate: 'Calculating...'
  });

  // Get company for calculations
  const gameState = getGameState();

  // Calculate preview stats whenever options change
  useEffect(() => {
    const totalCost = calculateLenderSearchCost(options);
    const { totalWork } = calculateLenderSearchWork(options);
    const weeks = Math.ceil(totalWork / 100); // Assuming 100 work units per week
    const timeEstimate = `${weeks} week${weeks === 1 ? '' : 's'}`;

    setPreviewStats({
      totalCost,
      totalWork,
      timeEstimate
    });
  }, [options]);

  // Handle submit
  const handleSubmit = async () => {
    const { startLenderSearch } = await import('@/lib/services');
    const activityId = await startLenderSearch(options);
    if (activityId) {
      onClose();
      if (onSearchStarted) {
        onSearchStarted();
      }
    }
  };

  if (!isOpen) return null;

  // Toggle lender type selection
  const toggleLenderType = (type: LenderType) => {
    const currentTypes = options.lenderTypes;
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    setOptions(prev => ({ ...prev, lenderTypes: newTypes }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Lender Search</h2>
            <p className="text-sm text-gray-400 mt-1">Configure parameters for finding loan offers</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Search Parameters */}
            <div className="space-y-6">
              {/* Number of Offers */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Number of Offers ({options.numberOfOffers})
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={options.numberOfOffers}
                  onChange={(e) => setOptions(prev => ({ ...prev, numberOfOffers: Number(e.target.value) }))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1 offer</span>
                  <span>20 offers</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Request multiple loan offers from different lenders. More offers increase search cost and time.
                </p>
              </div>

              {/* Lender Type Selection */}
              <div>
                <label className="block text-sm font-medium text-white mb-3">
                  Lender Types (select to constrain, empty = all types)
                </label>
                <div className="space-y-2">
                  {LENDER_TYPES.map((type) => {
                    const isSelected = options.lenderTypes.includes(type);
                    return (
                      <div
                        key={type}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750'
                        }`}
                        onClick={() => toggleLenderType(type)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{type}</span>
                          <span className="text-xs">
                            {isSelected ? '✓ Selected' : 'Click to select'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Constraining to specific lender types slightly increases search complexity. Leave all unselected to search all types.
                </p>
              </div>
            </div>

            {/* Right Column - Preview & Estimates */}
            <div className="space-y-6">
              {/* Search Preview */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Expected Results</h3>
                <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                  {/* Offer Count */}
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Loan Offers to Find</h4>
                    <div className="bg-blue-600 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-white">{options.numberOfOffers}</div>
                      <div className="text-xs text-blue-100 mt-1">offers will be generated</div>
                    </div>
                  </div>

                  {/* Lender Types */}
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Lender Types</h4>
                    <div className="bg-gray-700 rounded-lg p-3">
                      <div className="text-lg font-bold text-white text-center">
                        {options.lenderTypes.length === 0 ? 'All Types' : options.lenderTypes.join(', ')}
                      </div>
                      <div className="text-xs text-gray-300 mt-1 text-center">
                        {options.lenderTypes.length === 0 
                          ? 'Searching all lender types'
                          : `Searching ${options.lenderTypes.length} of 3 types`
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Search Estimates */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Search Estimates</h3>
                <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Search Cost:</span>
                    <span className="text-white font-medium">{formatCurrency(previewStats.totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Work Required:</span>
                    <span className="text-white font-medium">{Math.round(previewStats.totalWork)} units</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Estimated Time:</span>
                    <span className="text-white font-medium">{previewStats.timeEstimate}</span>
                  </div>
                </div>
              </div>

              {/* Search Criteria Summary */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Search Criteria</h3>
                <div className="bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Offers:</span>
                    <span className="text-white">{options.numberOfOffers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Lender Types:</span>
                    <span className="text-white">
                      {options.lenderTypes.length === 0 ? 'All' : `${options.lenderTypes.length} selected`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Available Funds:</span>
                    <span className="text-white">{formatCurrency(gameState.money || 0)}</span>
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
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={(gameState.money || 0) < previewStats.totalCost}
          >
            Start Search ({formatCurrency(previewStats.totalCost)})
          </Button>
        </div>
      </div>
    </div>
  );
};

